import { useEffect, useRef, useSyncExternalStore } from "react";

export const SNAPPA_CDN_URL =
  "https://cdn.snappa.dev/widget/v1/snappa-widget.js";

export const SNAPPA_USER_CHANGE_EVENT = "snappa:user-change";
export const SNAPPA_VISIBILITY_CHANGE_EVENT = "snappa:visibility-change";
export const SNAPPA_SHOW_EVENT = "snappa:show";
export const SNAPPA_CLOSE_EVENT = "snappa:close";
export const SNAPPA_READY_EVENT = "snappa:ready";
export const SNAPPA_ERROR_EVENT = "snappa:error";
export const SNAPPA_ENVIRONMENT_CHANGE_EVENT = "snappa:environment-change";
export const SNAPPA_CUSTOM_METADATA_CHANGE_EVENT =
  "snappa:custom-metadata-change";

export type SnappaUserData = {
  id?: string;
  email?: string;
  name?: string;
  image?: string;
};

export type SnappaCustomMetadata = Record<string, string>;

export type SnappaShowMode =
  | "simple"
  | "screenshot"
  | "video"
  | "speak"
  | "select-element";

export type SnappaApi = {
  setUser: (userData: SnappaUserData) => void;
  clearUser: () => void;
  setEnvironment: (environment: string) => void;
  clearEnvironment: () => void;
  setCustomMetadata: (customMetadata: SnappaCustomMetadata) => void;
  clearCustomMetadata: () => void;
  showWidget: () => void;
  hideWidget: () => void;
  open: (mode?: SnappaShowMode) => void;
  close: () => void;
};

export type SnappaWidgetProps = {
  apiKey: string;
  apiBaseUrl?: string;
  environment?: string;
  userData?: SnappaUserData;
  customMetadata?: SnappaCustomMetadata;
  defaultVisible?: boolean;
};

export type SnappaWidgetState = {
  loaded: boolean;
  loading: boolean;
  visible: boolean;
  user: SnappaUserData;
  environment: string;
  customMetadata: SnappaCustomMetadata;
  error: Error | null;
};

export type UseSnappaResult = SnappaWidgetState & {
  showWidget: () => void;
  hideWidget: () => void;
  open: (mode?: SnappaShowMode) => void;
  close: () => void;
  setUser: (userData: SnappaUserData) => void;
  clearUser: () => void;
  setEnvironment: (environment: string) => void;
  clearEnvironment: () => void;
  setCustomMetadata: (customMetadata: SnappaCustomMetadata) => void;
  clearCustomMetadata: () => void;
};

type WindowWithSnappa = Window & {
  snappa?: SnappaApi;
  __snappaWidgetStatus?: "loading" | "ready" | "error";
  __snappaWidgetError?: string;
};

const INITIAL_STATE: SnappaWidgetState = {
  loaded: false,
  loading: false,
  visible: true,
  user: {},
  environment: "default",
  customMetadata: {},
  error: null,
};

let state = INITIAL_STATE;
let scriptPromise: Promise<SnappaApi> | null = null;
let scriptConfig: { apiKey: string; apiBaseUrl?: string } | null = null;
const listeners = new Set<() => void>();

const getSnappaApi = () =>
  typeof window === "undefined"
    ? undefined
    : (window as WindowWithSnappa).snappa;

const publish = (update: Partial<SnappaWidgetState>) => {
  state = { ...state, ...update };
  listeners.forEach((listener) => listener());
};

const handleUserChange = (event: Event) => {
  const user = (event as CustomEvent<SnappaUserData>).detail;
  if (user) publish({ user: { ...user } });
};

const handleVisibilityChange = (event: Event) => {
  const visible = (event as CustomEvent<boolean>).detail;
  publish({
    visible: typeof visible === "boolean" ? visible : !state.visible,
  });
};

const handleEnvironmentChange = (event: Event) => {
  const environment = (event as CustomEvent<string | undefined>).detail;
  publish({ environment: environment ?? "default" });
};

const handleCustomMetadataChange = (event: Event) => {
  const customMetadata = (
    event as CustomEvent<SnappaCustomMetadata | undefined>
  ).detail;
  publish({ customMetadata: customMetadata ? { ...customMetadata } : {} });
};

const handleReady = () => publish({ loaded: true, loading: false, error: null });

const handleError = (event: Event) => {
  const detail = (event as CustomEvent<Error | string>).detail;
  const error = detail instanceof Error ? detail : new Error(String(detail));
  publish({ loaded: false, loading: false, error });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener(SNAPPA_USER_CHANGE_EVENT, handleUserChange);
    window.addEventListener(
      SNAPPA_VISIBILITY_CHANGE_EVENT,
      handleVisibilityChange,
    );
    window.addEventListener(
      SNAPPA_ENVIRONMENT_CHANGE_EVENT,
      handleEnvironmentChange,
    );
    window.addEventListener(
      SNAPPA_CUSTOM_METADATA_CHANGE_EVENT,
      handleCustomMetadataChange,
    );
    window.addEventListener(SNAPPA_READY_EVENT, handleReady);
    window.addEventListener(SNAPPA_ERROR_EVENT, handleError);

    const globalWindow = window as WindowWithSnappa;
    if (globalWindow.snappa) {
      const status = globalWindow.__snappaWidgetStatus;
      publish({
        loaded: status === undefined || status === "ready",
        loading: status === "loading",
        error:
          status === "error"
            ? new Error(
                globalWindow.__snappaWidgetError ||
                  "Unable to initialize the Snappa widget",
              )
            : null,
      });
    }
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener(SNAPPA_USER_CHANGE_EVENT, handleUserChange);
      window.removeEventListener(
        SNAPPA_VISIBILITY_CHANGE_EVENT,
        handleVisibilityChange,
      );
      window.removeEventListener(
        SNAPPA_ENVIRONMENT_CHANGE_EVENT,
        handleEnvironmentChange,
      );
      window.removeEventListener(
        SNAPPA_CUSTOM_METADATA_CHANGE_EVENT,
        handleCustomMetadataChange,
      );
      window.removeEventListener(SNAPPA_READY_EVENT, handleReady);
      window.removeEventListener(SNAPPA_ERROR_EVENT, handleError);
    }
  };
};

const getSnapshot = () => state;
const getServerSnapshot = () => INITIAL_STATE;

function requireSnappaApi(): SnappaApi {
  const api = getSnappaApi();
  if (!api) {
    throw new Error(
      "Snappa is not loaded. Render <SnappaWidget /> before calling its API.",
    );
  }
  return api;
}

function loadCdnScript(options: SnappaWidgetProps): Promise<SnappaApi> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    return Promise.reject(new TypeError("Snappa apiKey must not be empty"));
  }

  const requestedConfig = {
    apiKey,
    apiBaseUrl: options.apiBaseUrl?.replace(/\/+$/, ""),
  };
  if (
    scriptConfig &&
    (scriptConfig.apiKey !== requestedConfig.apiKey ||
      scriptConfig.apiBaseUrl !== requestedConfig.apiBaseUrl)
  ) {
    return Promise.reject(
      new Error(
        "Only one Snappa project and API base URL can be loaded per page.",
      ),
    );
  }
  scriptConfig ??= requestedConfig;

  const loadedApi = getSnappaApi();
  if (loadedApi) return Promise.resolve(loadedApi);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<SnappaApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = SNAPPA_CDN_URL;
    script.dataset.key = apiKey;
    script.dataset.apiBaseUrl = options.apiBaseUrl || "";
    script.dataset.environment = options.environment || "default";
    script.dataset.defaultVisible = String(options.defaultVisible ?? true);

    for (const [key, value] of Object.entries(options.userData || {})) {
      if (value !== undefined) {
        script.dataset[`user${key[0].toUpperCase()}${key.slice(1)}`] = value;
      }
    }
    for (const [key, value] of Object.entries(options.customMetadata || {})) {
      script.setAttribute(`data-meta-${key}`, value);
    }

    script.onload = () => {
      const loadedApi = getSnappaApi();
      if (!loadedApi) {
        reject(
          new Error(
            "The Snappa CDN script loaded, but window.snappa was not initialized.",
          ),
        );
        return;
      }
      resolve(loadedApi);
    };
    script.onerror = () =>
      reject(new Error(`Unable to load the Snappa CDN script: ${SNAPPA_CDN_URL}`));

    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    scriptConfig = null;
    throw error;
  });

  return scriptPromise;
}

function applyInitialContext(api: SnappaApi, options: SnappaWidgetProps) {
  if (options.userData) api.setUser(options.userData);
  if (options.environment) api.setEnvironment(options.environment);
  if (options.customMetadata) api.setCustomMetadata(options.customMetadata);
  if (options.defaultVisible === false) api.hideWidget();
}

export function SnappaWidget(props: SnappaWidgetProps): null {
  const initialProps = useRef(props);

  useEffect(() => {
    let cancelled = false;
    const options = initialProps.current;

    publish({
      loading: true,
      error: null,
      visible: options.defaultVisible ?? true,
      user: { ...options.userData },
      environment: options.environment || "default",
      customMetadata: { ...options.customMetadata },
    });

    void loadCdnScript(options)
      .then((api) => {
        if (cancelled) return;
        applyInitialContext(api, options);
        const globalWindow = window as WindowWithSnappa;
        const status = globalWindow.__snappaWidgetStatus;
        publish({
          loaded: status === undefined || status === "ready",
          loading: status === "loading",
          error:
            status === "error"
              ? new Error(
                  globalWindow.__snappaWidgetError ||
                    "Unable to initialize the Snappa widget",
                )
              : null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        publish({
          loaded: false,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

export function useSnappa(): UseSnappaResult {
  const currentState = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return {
    ...currentState,
    showWidget: () => {
      requireSnappaApi().showWidget();
      publish({ visible: true });
    },
    hideWidget: () => {
      requireSnappaApi().hideWidget();
      publish({ visible: false });
    },
    open: (mode) => requireSnappaApi().open(mode),
    close: () => requireSnappaApi().close(),
    setUser: (userData) => {
      requireSnappaApi().setUser(userData);
      publish({ user: { ...userData } });
    },
    clearUser: () => {
      requireSnappaApi().clearUser();
      publish({ user: {} });
    },
    setEnvironment: (environment) => {
      requireSnappaApi().setEnvironment(environment);
      publish({ environment });
    },
    clearEnvironment: () => {
      requireSnappaApi().clearEnvironment();
      publish({ environment: "default" });
    },
    setCustomMetadata: (customMetadata) => {
      requireSnappaApi().setCustomMetadata(customMetadata);
      publish({ customMetadata: { ...customMetadata } });
    },
    clearCustomMetadata: () => {
      requireSnappaApi().clearCustomMetadata();
      publish({ customMetadata: {} });
    },
  };
}
