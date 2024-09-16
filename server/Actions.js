// All the events

const ACTIONS = {
  JOIN: "join",
  JOINED: "joined",
  DISCONNECTED: "disconnected",
  CODE_CHANGE: "conde-change",
  SYNC_CODE: "sync-code",
  LEAVE: "leave",
  // New actions for group messaging
  SEND_MESSAGE: "send-message",
  NEW_MESSAGE: "new-message",
  // New actions for audio sharing
  START_AUDIO: "start-audio",
  STOP_AUDIO: "stop-audio",
  USER_STARTED_AUDIO: "user-started-audio",
  USER_STOPPED_AUDIO: "user-stopped-audio",
  AUDIO_DATA: "audio-data",
  RECEIVE_AUDIO_DATA: "receive-audio-data",
};

module.exports = ACTIONS;
