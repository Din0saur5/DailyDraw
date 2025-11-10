type AnalyticsParams = Record<string, unknown>;

type AnalyticsClient = {
  trackScreenView: (screenName: string, params?: AnalyticsParams) => void;
  trackEvent: (eventName: string, params?: AnalyticsParams) => void;
};

const devLogger = (type: 'screen' | 'event', name: string, params?: AnalyticsParams) => {
  if (__DEV__) {
    console.debug(`[analytics:${type}] ${name}`, params ?? {});
  }
};

let client: AnalyticsClient = {
  trackScreenView: (screenName, params) => devLogger('screen', screenName, params),
  trackEvent: (eventName, params) => devLogger('event', eventName, params),
};

export function configureAnalytics(customClient: Partial<AnalyticsClient>) {
  client = { ...client, ...customClient };
}

export function trackScreenView(screenName: string, params?: AnalyticsParams) {
  client.trackScreenView(screenName, params);
}

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  client.trackEvent(eventName, params);
}

export function useAnalytics() {
  return { trackScreenView, trackEvent };
}
