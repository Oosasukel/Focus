const startFocusButton = document.getElementById('start-focus');
const startFreeTimeButton = document.getElementById('start-free-time');
const clearButton = document.getElementById('clear');
const titleElement = document.getElementById('title');

const focusInput = document.getElementById('focus-input');
const restInput = document.getElementById('rest-input');
const funInput = document.getElementById('fun-input');

const focusTimeElement = document.getElementById('focus-time');
const freeTimeElement = document.getElementById('free-time');

let state = null;

const init = () => {
  setupButtons();
  setupInputs();
  setupBackgroundListener();
  setupState();
};

const setupButtons = () => {
  startFocusButton.addEventListener('click', () => {
    let newState;
    if (state !== 'focus') {
      newState = 'focus';
    } else {
      newState = 'stop';
    }

    chrome.runtime.sendMessage({
      type: 'changeState',
      payload: newState,
    });
  });

  startFreeTimeButton.addEventListener('click', () => {
    let newState;
    if (state !== 'free') {
      newState = 'free';
    } else {
      newState = 'stop';
    }

    chrome.runtime.sendMessage({
      type: 'changeState',
      payload: newState,
    });
  });

  clearButton.addEventListener('click', clearAll);
};

const setupInputs = () => {
  focusInput.addEventListener('change', updateConfig);
  restInput.addEventListener('change', updateConfig);
  funInput.addEventListener('change', updateConfig);
};

const getStorage = async () => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (storage) => resolve(storage));
  });
};

const changeState = (storage) => {
  const newState = storage.state;
  const timer = storage.timer;

  startFocusButton.innerText = `Start Focus`;
  startFocusButton.removeAttribute('class');
  startFocusButton.classList.add('blue');

  startFreeTimeButton.innerText = `Start Free Time`;
  startFreeTimeButton.removeAttribute('class');
  startFreeTimeButton.classList.add('green');

  switch (newState) {
    case 'stop': {
      titleElement.innerText = `Stopped`;
      titleElement.removeAttribute('class');
      titleElement.classList.add('gray');
      break;
    }
    case 'rest': {
      titleElement.innerText = `Rest ${timer}min`;
      titleElement.removeAttribute('class');
      titleElement.classList.add('gray');
      break;
    }
    case 'free': {
      titleElement.innerText = `Free Time ${timer}min`;
      titleElement.removeAttribute('class');
      titleElement.classList.add('green');

      startFreeTimeButton.innerText = `Stop Free Time`;
      startFreeTimeButton.removeAttribute('class');
      startFreeTimeButton.classList.add('orange');
      break;
    }
    case 'focus': {
      titleElement.innerText = `Focus ${timer}min`;
      titleElement.removeAttribute('class');
      titleElement.classList.add('blue');

      startFocusButton.innerText = `Stop Focus`;
      startFocusButton.removeAttribute('class');
      startFocusButton.classList.add('orange');
      break;
    }
  }

  state = newState;
};

const setupBackgroundListener = () => {
  chrome.runtime.onMessage.addListener(({ type, payload }, callback) => {
    switch (type) {
      case 'changeFrontState': {
        getStorage().then((storage) => changeState(storage));
        break;
      }
      case 'updateTime': {
        getStorage().then((storage) => {
          focusTimeElement.innerText = storage.focusTime;
          freeTimeElement.innerText = storage.freeTime;
        });
        break;
      }
      case 'clear': {
        setupState();

        break;
      }
    }
  });
};

const setupState = () => {
  getStorage().then((storage) => {
    changeState(storage);

    focusInput.value = storage.config.focusTime;
    funInput.value = storage.config.freeTime;
    restInput.value = storage.config.restTime;

    focusTimeElement.innerText = storage.focusTime;
    freeTimeElement.innerText = storage.freeTime;
  });
};

const clearAll = () => {
  chrome.runtime.sendMessage({
    type: 'clear',
  });
};

const updateConfig = () => {
  chrome.runtime.sendMessage({
    type: 'update-config',
    payload: {
      focusTime: focusInput.value,
      freeTime: funInput.value,
      restTime: restInput.value,
    },
  });
};

init();
