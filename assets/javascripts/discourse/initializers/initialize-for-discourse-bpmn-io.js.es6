import { withPluginApi } from 'discourse/lib/plugin-api';
import Mobile from 'discourse/lib/mobile';

const ERROR_MESSAGE = 'Failed to display the preview. See console for details.';

export default {
  name: 'bpmn-io-previews',
  initialize() {
    withPluginApi('0.8.41', api => {

      // disable for mobile
      if (Mobile.mobileView) return;

      try {
        api.decorateCookedElement(
          post => {
            const diagramLinks = post.querySelectorAll(
              '.attachment[href$=".bpmn"], .attachment[href$=".dmn"]');

            for (const diagramLink of diagramLinks) {
              const preview = createPreviewElement(diagramLink.textContent, diagramLink.href);

              diagramLink.parentElement.appendChild(preview);
            }
          },
          {
            id: 'bpmn-io-previews',
            onlyStream: true
          }
        );
      } catch (error) {
        console.error('There\'s an issue in the bpmn.io preview component.', error);
      }
    });
  }
};


function createPreviewElement(filename, diagramLink) {
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = `Preview ${filename}`
  details.appendChild(summary);

  details.addEventListener('toggle', async () => {
    const previewContainer = createPreviewContainer(filename);
    const type = getDiagramType(filename);

    try {
      await appendAndLoad(details, previewContainer);

      const response = await fetch(diagramLink);

      if (!response.ok) {
        throw new Error(`Error when fetching diagram: ${res.status}`);
      }

      const text = await response.text();

      await loadDiagram(type, previewContainer, text);
    } catch (error) {
      postMessage({ type: 'error' });
      console.error('Failed to display the preview', error);
    }
  }, { once: true });

  return details;
};

function createPreviewContainer() {
  const preview = document.createElement('div');
  preview.classList.add('bpmn-io-preview');

  return preview;
}

function getDiagramType(filename) {
  if (filename.endsWith('.bpmn')) {
    return 'bpmn';
  } else if (filename.endsWith('.dmn')) {
    return 'dmn';
  }
}


function loadDiagram(type, container, diagramXML) {

  try {
    if (type === 'bpmn') {
      return loadBpmn(container, diagramXML);
    } else if (type === 'dmn') {
      return loadDmn(container, diagramXML);
    }
  } catch (error) {
    console.error('Unable to display preview:', error);
    container.textContent = `${ERROR_MESSAGE}`;
  }
}

function loadBpmn(container, diagramXML) {
  const viewer = new BpmnJS({
    container
  });

  return viewer.importXML(diagramXML)
    .then(() => {
      viewer.get('canvas').zoom('fit-viewport');
    });
}

function loadDmn(container, diagramXML) {
  const viewer = new DmnJS({
    container
  });

  return viewer.importXML(diagramXML)
    .then(() => {
      viewer.getActiveViewer()
        .get('canvas')
        .zoom('fit-viewport');
    });
}

function appendAndLoad(parent, child) {
  return new Promise(resolve => {
    parent.appendChild(child);
    child.onload = resolve;
  });
}
