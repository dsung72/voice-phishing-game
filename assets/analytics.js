
    (() => {
      const measurementId = "G-95DKGBG9MY";
      const supportedProtocol = location.protocol === "https:" || location.protocol === "http:";
      let savedConsent = null;
      try { savedConsent = localStorage.getItem("voice_game_analytics_consent"); } catch (_) {}
      window.GA_MEASUREMENT_ID = measurementId;
      window.analyticsSupported = supportedProtocol;
      window.analyticsConsent = savedConsent;
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
      window.loadGoogleAnalytics = () => {
        if (!supportedProtocol || window.__googleAnalyticsLoaded) return;
        window.__googleAnalyticsLoaded = true;
        const tag = document.createElement("script");
        tag.async = true;
        tag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
        document.head.appendChild(tag);
        window.gtag("js", new Date());
        window.gtag("config", measurementId, { send_page_view: true });
      };
      if (savedConsent === "granted") window.loadGoogleAnalytics();
    })();
  