const initialStorage = {
  state: 'stop',
  timer: '',
  freeTime: 0,
  focusTime: 0,
  config: {
    focusTime: 60,
    freeTime: 15,
    restTime: 10,
  },
};

chrome.runtime.onInstalled.addListener(() => {
  onInit();

  chrome.storage.sync.get(null, (persistedStorage) => {
    if (!persistedStorage.config) {
      chrome.storage.sync.set(initialStorage);
    }
  });
});

const onInit = () => {
  chrome.notifications.onClicked.addListener((notificationId) => {
    switch (notificationId) {
      case 'focus': {
        changeState('rest');
        break;
      }
      case 'free': {
        changeState('focus');
        break;
      }
      case 'rest': {
        changeState('focus');
        break;
      }
    }
  });
};

chrome.runtime.onMessage.addListener(({ type, payload }, callback) => {
  switch (type) {
    case 'changeState': {
      const newState = payload;
      changeState(newState);
      break;
    }
    case 'clear': {
      chrome.storage.sync.clear();
      chrome.storage.sync.set(initialStorage, () => {
        onInit();
      });

      chrome.runtime.sendMessage({
        type: 'clear',
      });
      break;
    }
    case 'update-config': {
      const newConfig = payload;

      chrome.storage.sync.set({ config: newConfig });
      break;
    }
  }
});

const setStorage = async (state) => {
  return new Promise((resolve) => {
    chrome.storage.sync.set(state, resolve);
  });
};

const changeState = async (newState) => {
  console.log('New State:', newState);

  await setStorage({ state: newState });

  chrome.alarms.clear('updateTimer');

  switch (newState) {
    case 'stop': {
      chrome.browserAction.setBadgeText({ text: '' });

      await setStorage({ timer: '' });
      break;
    }
    case 'rest': {
      chrome.browserAction.setBadgeBackgroundColor({ color: '#444' });

      await startRest();
      break;
    }
    case 'free': {
      chrome.browserAction.setBadgeBackgroundColor({ color: '#0b4' });

      await startFreeTime();
      break;
    }
    case 'focus': {
      chrome.browserAction.setBadgeBackgroundColor({ color: '#08f' });

      await startFocus();
      break;
    }
  }

  chrome.runtime.sendMessage({
    type: 'changeFrontState',
  });
};

const startFocus = async () => {
  return new Promise((resolve) => {
    getStorage().then((storage) => {
      const initialTime = storage.config.focusTime;

      chrome.storage.sync.set({ timer: initialTime }, () => {
        startTimer(initialTime, 'focus');

        resolve();
      });
    });
  });
};

const updateFreeTime = (newFreeTime) => {
  chrome.storage.sync.set({ freeTime: newFreeTime }, () => {
    chrome.runtime.sendMessage({
      type: 'updateTime',
    });
  });
};

const getStorage = async () => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (storage) => resolve(storage));
  });
};

const startFreeTime = async () => {
  return new Promise((resolve) => {
    getStorage().then((storage) => {
      const initialTimer = storage.freeTime;

      chrome.storage.sync.set({ timer: initialTimer }, () => {
        startTimer(initialTimer, 'free', true);

        resolve();
      });
    });
  });
};

const startRest = () => {
  return new Promise((resolve) => {
    getStorage().then((storage) => {
      const initialTimer = storage.config.restTime;

      chrome.storage.sync.set({ timer: initialTimer }, () => {
        startTimer(initialTimer, 'rest');

        resolve();
      });
    });
  });
};

// Start Timer

chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.alarms.create('updateTimer', {
    delayInMinutes: 1,
  });

  chrome.storage.sync.get(['alarm'], (alarmConfig) => {
    const { isFreeTime, initialTime, startDateTime, timerType } =
      alarmConfig.alarm;

    const elapsedTime = elapsedTimeFrom(startDateTime);
    const newTime = initialTime - elapsedTime;

    chrome.storage.sync.set({ timer: newTime });

    if (newTime <= 0) {
      updateTimer('');

      chrome.alarms.clear('updateTimer');

      switch (timerType) {
        case 'focus': {
          finishFocusTime();
          break;
        }
        case 'rest': {
          finishRestTime();
          break;
        }
        case 'free': {
          finishFreeTime();
          break;
        }
      }
    } else {
      updateTimer(newTime);
    }

    if (isFreeTime) {
      updateFreeTime(newTime);
    }
  });
});

const startTimer = (initialTime, timerType, isFreeTime) => {
  const startDateTime = new Date().getTime();

  updateTimer(initialTime);

  chrome.storage.sync.set(
    {
      alarm: {
        isFreeTime,
        initialTime,
        startDateTime,
        timerType,
      },
    },
    () => {
      chrome.alarms.create('updateTimer', {
        delayInMinutes: 1,
      });
    }
  );
};

const elapsedTimeFrom = (initialDateTimestamp) => {
  const currentDateTime = new Date();
  const elapsedTime = Math.floor(
    (currentDateTime.getTime() - initialDateTimestamp) / (60 * 1000)
  );

  return elapsedTime;
};

const updateTimer = (newTime) => {
  chrome.browserAction.setBadgeText({ text: `${String(newTime)}m` });

  chrome.runtime.sendMessage({
    type: 'changeFrontState',
  });
};

const finishFocusTime = () => {
  chrome.notifications.clear('focus', () => {
    chrome.notifications.create('focus', {
      requireInteraction: true,
      title: 'Focus finished',
      iconUrl: './notification.png',
      message: 'Click to start rest.',
      type: 'basic',
    });
  });

  getStorage().then((storage) => {
    const { initialTime } = storage.alarm;

    changeState('stop');

    chrome.storage.sync.set(
      {
        freeTime: Number(storage.freeTime) + Number(storage.config.freeTime),
        focusTime: Number(storage.focusTime) + Number(initialTime),
      },
      () => {
        chrome.runtime.sendMessage({
          type: 'updateTime',
        });
      }
    );
  });
};

const finishRestTime = () => {
  chrome.notifications.clear('rest', () => {
    chrome.notifications.create('rest', {
      requireInteraction: true,
      title: 'The rest is over',
      iconUrl: './notification.png',
      message: 'Click to return to focus.',
      type: 'basic',
    });
  });

  changeState('stop');
};

const finishFreeTime = () => {
  chrome.notifications.clear('free', () => {
    chrome.notifications.create('free', {
      requireInteraction: true,
      title: 'Free time is over',
      iconUrl: './notification.png',
      message: 'Click to return to focus.',
      type: 'basic',
    });
  });

  changeState('stop');
};

onInit();
