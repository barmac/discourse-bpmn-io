import { apiInitializer } from "discourse/lib/api";
import { decorateDiagramAttachments } from "discourse/plugins/discourse-bpmn-io/discourse/lib/bpmn-io-preview";

export default apiInitializer((api) => {
  const siteSettings = api.container.lookup("service:site-settings");

  if (!siteSettings.discourse_bpmn_io_enabled) {
    return;
  }

  const site = api.container.lookup("service:site");

  api.decorateCookedElement(
    (element) => {
      // previews need more room than the mobile layout offers
      if (site.mobileView) {
        return;
      }

      decorateDiagramAttachments(element);
    },
    { onlyStream: true }
  );
});
