import React, { useEffect, useRef, useState } from "react";
import Avatar from "react-avatar";
import { IoMdMic, IoMdMicOff } from "react-icons/io";
import { ACTIONS } from "../Actions";
import { toast } from "react-hot-toast";
import { useLocation } from "react-router-dom"; // Added useLocation

function Client({
  codeRef,
  clients,
  setClients,
  copyRoomId,
  leaveRoom,
  socketRef,
  startAudioSharing,
  stopAudioSharing,
}) {
  const [isSharing, setIsSharing] = useState(false);
  const isSpeaking = useRef({});
  const Location = useLocation(); // Added to access username

  useEffect(() => {
    if (socketRef.current) {
      // Listen for new clients joining the chatroom
      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== Location.state?.username) {
            toast.success(`${username} joined the room.`);
          }
          setClients(clients);
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      // Listen for clients disconnecting
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });

      // Listen for audio start
      socketRef.current.on(ACTIONS.USER_STARTED_AUDIO, ({ userId }) => {
        console.log("user started audio", userId);
        setClients((prev) =>
          prev.map((client) =>
            client.username === userId ? { ...client, isMuted: false } : client
          )
        );
        toast.success(`${userId} started speaking.`);
      });

      // Listen for audio stop
      socketRef.current.on(ACTIONS.USER_STOPPED_AUDIO, ({ userId }) => {
        setClients((prev) =>
          prev.map((client) =>
            client.username === userId ? { ...client, isMuted: true } : client
          )
        );
        toast.success(`${userId} stopped speaking.`);
      });

      // Listen for receiving audio data
      socketRef.current.on(
        ACTIONS.RECEIVE_AUDIO_DATA,
        ({ audioChunk, userId }) => {
          var newData = audioChunk.split(";");
          newData[0] = "data:audio/ogg;";
          newData = newData[0] + newData[1];

          var audio = new Audio(newData);
          if (!audio || document.hidden) {
            return;
          }
          audio.play()
            .then(() => {
              isSpeaking.current[userId] = true;
            })
            .catch((error) => {
              console.log(error);
              isSpeaking.current[userId] = false;
            });
        }
      );

      // Clean up event listeners on unmount
      return () => {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off(ACTIONS.USER_STARTED_AUDIO);
        socketRef.current.off(ACTIONS.USER_STOPPED_AUDIO);
        socketRef.current.off(ACTIONS.RECEIVE_AUDIO_DATA);
      };
    }
  }, [socketRef.current]);

  const toggleAudioSharing = () => {
    if (isSharing) {
      stopAudioSharing();
    } else {
      startAudioSharing();
    }
    setIsSharing(!isSharing);
  };

  return (
    <div
      className="col-md-2 bg-dark text-light d-flex flex-column h-100"
      style={{ boxShadow: "2px 0px 4px rgba(0, 0, 0, 0.1)" }}
    >
      <h3 className="text-center mt-2 mb-4">SourceSync</h3>

      {/* Client list container */}
      <div className="d-flex flex-column flex-grow-1 overflow-auto">
        <span className="mb-2">Members</span>
        {clients?.map((client) => (
          <div
            key={client.socketId}
            className="client-container d-flex align-items-center justify-content-between mb-3"
          >
            <div className="d-flex align-items-center overflow-hidden">
              <Avatar
                name={client.username}
                size={40}
                round="50%"
                className={
                  isSpeaking.current[client.username]
                    ? "avatar speaking mr-3"
                    : "avatar mr-3"
                }
              />
              <span className="mx-2">{client.username}</span>
            </div>
            <div>
              {client.isMuted ? (
                <IoMdMicOff size={20} />
              ) : (
                <IoMdMic size={20} />
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={toggleAudioSharing}
        className={`btn ${isSharing ? "btn-danger" : "btn-success"} mb-3`}
      >
        {isSharing ? "Stop Audio Sharing" : "Start Audio Sharing"}
      </button>
      <hr />
      {/* Buttons */}
      <div className="mt-auto">
        <button className="btn btn-success" onClick={copyRoomId}>
          Copy Room ID
        </button>
        <button
          className="btn btn-danger mt-2 mb-2 px-3 btn-block"
          onClick={leaveRoom}
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}

export default Client;
