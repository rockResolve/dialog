import {dialogOptions} from '../dialog-options';
import {DOM} from 'aurelia-pal';
import {transient} from 'aurelia-dependency-injection';

let containerTagName = 'ai-dialog-container';
let overlayTagName = 'ai-dialog-overlay';
let transitionEvent = (function() {
  let transition = null;

  return function() {
    if (transition) return transition;

    let t;
    let el = DOM.createElement('fakeelement');
    let transitions = {
      'transition': 'transitionend',
      'OTransition': 'oTransitionEnd',
      'MozTransition': 'transitionend',
      'WebkitTransition': 'webkitTransitionEnd'
    };
    for (t in transitions) {
      if (el.style[t] !== undefined) {
        transition = transitions[t];
        return transition;
      }
    }
  };
}());

@transient()
export class DialogRenderer {
  dialogControllers = [];
  escapeKeyEvent = (e) => {
    if (e.keyCode === 27) {
      let top = this.dialogControllers[this.dialogControllers.length - 1];
      if (top && top.settings.lock !== true) {
        top.cancel();
      }
    }
  };

  constructor() {
    this.defaultSettings = dialogOptions;
  }

  getDialogContainer() {
    return DOM.createElement('div');
  }

  showDialog(dialogController: DialogController) {
    if (!dialogController.showDialog) {
      return this._createDialogHost(dialogController).then(() => {
        return dialogController.showDialog();
      });
    }
    return dialogController.showDialog();
  }

  hideDialog(dialogController: DialogController) {
    return dialogController.hideDialog().then(() => {
      return dialogController.destroyDialogHost();
    });
  }

  _createDialogHost(dialogController: DialogController) {
    let settings = dialogController.settings;
    let modalOverlay = DOM.createElement(overlayTagName);
    let modalContainer = DOM.createElement(containerTagName);
    let wrapper = document.createElement('div');
    let anchor = dialogController.slot.anchor;
    wrapper.appendChild(anchor);
    modalContainer.appendChild(wrapper);
    let body = DOM.querySelectorAll('body')[0];
    let closeModalClick = (e) => {
      if (!settings.lock && !e._aureliaDialogHostClicked) {
        dialogController.cancel();
      } else {
        return false;
      }
    };

    let stopPropagation = (e) => { e._aureliaDialogHostClicked = true; };

    let dialogHost = modalContainer.querySelector('ai-dialog');

    dialogController.showDialog = () => {
      if (!this.dialogControllers.length) {
        DOM.addEventListener('keyup', this.escapeKeyEvent);
      }

      this.dialogControllers.push(dialogController);

      dialogController.slot.attached();

      if (typeof settings.position === 'function') {
        settings.position(modalContainer, modalOverlay);
      } else {
        dialogController.centerDialog();
      }

      modalContainer.addEventListener('click', closeModalClick);
      dialogHost.addEventListener('click', stopPropagation);

      return new Promise((resolve) => {
        modalContainer.addEventListener(transitionEvent(), this.onShowTransitionEnd);

        this.onShowTransitionEnd = function onShowTransitionEnd(e) {
          if (e && e.target !== modalContainer) {
            return;
          }
          modalContainer.removeEventListener(transitionEvent(), this.onShowTransitionEnd);
          resolve();
        }

        //transitionEvent does not always fire.
        //But onShowTransitionEnd resolve() is needed for caller to await showDialogPromise.
        setTimeout(this.onShowTransitionEnd, settings.showDialogTimeout);

        modalOverlay.classList.add('active');
        modalContainer.classList.add('active');
        body.classList.add('ai-dialog-open');
      });
    };

    dialogController.hideDialog = () => {
      modalContainer.removeEventListener('click', closeModalClick);
      dialogHost.removeEventListener('click', stopPropagation);

      //If dialog closed immediately after opened, and caller did not wait for showDialogPromise to complete, ensure Show completes
      this.onShowTransitionEnd();

      let i = this.dialogControllers.indexOf(dialogController);
      if (i !== -1) {
        this.dialogControllers.splice(i, 1);
      }

      if (!this.dialogControllers.length) {
        DOM.removeEventListener('keyup', this.escapeKeyEvent);
      }

      return new Promise((resolve) => {
        modalContainer.addEventListener(transitionEvent(), onTransitionEnd);

        function onTransitionEnd() {
          modalContainer.removeEventListener(transitionEvent(), onTransitionEnd);
          resolve();
        }

        modalOverlay.classList.remove('active');
        modalContainer.classList.remove('active');

        if (!this.dialogControllers.length) {
          body.classList.remove('ai-dialog-open');
        }
      });
    };

    dialogController.centerDialog = () => {
      if (settings.centerHorizontalOnly) return;
      centerDialog(modalContainer);
    };

    dialogController.destroyDialogHost = () => {
      body.removeChild(modalOverlay);
      body.removeChild(modalContainer);
      dialogController.slot.detached();
      return Promise.resolve();
    };

    modalOverlay.style.zIndex = this.defaultSettings.startingZIndex;
    modalContainer.style.zIndex = this.defaultSettings.startingZIndex;

    let lastContainer = Array.from(body.querySelectorAll(containerTagName)).pop();

    if (lastContainer) {
      lastContainer.parentNode.insertBefore(modalContainer, lastContainer.nextSibling);
      lastContainer.parentNode.insertBefore(modalOverlay, lastContainer.nextSibling);
    } else {
      body.insertBefore(modalContainer, body.firstChild);
      body.insertBefore(modalOverlay, body.firstChild);
    }

    return Promise.resolve();
  }
}

function centerDialog(modalContainer) {
  const child = modalContainer.children[0];
  const vh = Math.max(DOM.querySelectorAll('html')[0].clientHeight, window.innerHeight || 0);

  child.style.marginTop = Math.max((vh - child.offsetHeight) / 2, 30) + 'px';
  child.style.marginBottom = Math.max((vh - child.offsetHeight) / 2, 30) + 'px';
}
