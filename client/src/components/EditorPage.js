import React, { useEffect, useRef, useState } from "react";
import Client from "./Client";
import Editor from "./Editor";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import {
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import { toast } from "react-hot-toast";

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [messages, setMessages] = useState([]);
  const [audioStreams, setAudioStreams] = useState({});
  const codeRef = useRef(null);

  const Location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();

  const socketRef = useRef(null);
  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      const handleErrors = (err) => {
        console.log("Error", err);
        toast.error("Socket connection failed, Try again later");
        navigate("/");
      };

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: Location.state?.username,
      });

      // Listen for new clients joining the chatroom
      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          // this insure that new user connected message do not display to that user itself
          if (username !== Location.state?.username) {
            toast.success(`${username} joined the room.`);
          }
          setClients(clients);
          // also send the code to sync
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      // listening for disconnected
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });
      // New event listeners for chat and audio
      socketRef.current.on(ACTIONS.NEW_MESSAGE, ({ message, sender }) => {
        setMessages((prev) => [...prev, { message, sender }]);
      });

      socketRef.current.on(ACTIONS.USER_STARTED_AUDIO, ({ userId }) => {
        toast.success(`${userId} started sharing audio`);
        // You might want to update UI to show who's sharing audio
      });

      socketRef.current.on(ACTIONS.USER_STOPPED_AUDIO, ({ userId }) => {
        toast.success(`${userId} stopped sharing audio`);
        setAudioStreams((prev) => {
          const newStreams = { ...prev };
          delete newStreams[userId];
          return newStreams;
        });
      });

      socketRef.current.on(
        ACTIONS.RECEIVE_AUDIO_DATA,
        ({ audioChunk, userId }) => {
          const audioContext = new AudioContext();
          const source = audioContext.createBufferSource();

          audioChunk.arrayBuffer().then((buffer) => {
            audioContext.decodeAudioData(buffer, (decodedData) => {
              source.buffer = decodedData;
              source.connect(audioContext.destination);
              source.start();
            });
          });

          setAudioStreams((prev) => ({
            ...prev,
            [userId]: audioChunk,
          }));
        }
      );
    };
    init();
    // cleanup
    return () => {
      socketRef.current?.disconnect();
      Object.values(ACTIONS).forEach((action) =>
        socketRef.current?.off(action)
      );
    };
  }, []);

  if (!Location.state) {
    return <Navigate to="/" />;
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success(`roomIs is copied`);
    } catch (error) {
      console.log(error);
      toast.error("unable to copy the room Id");
    }
  };

  const leaveRoom = async () => {
    navigate("/");
  };

  const sendMessage = (message) => {
    socketRef.current.emit(ACTIONS.SEND_MESSAGE, {
      roomId,
      message,
      sender: Location.state?.username,
    });
  };

  const startAudioSharing = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        socketRef.current.emit(ACTIONS.START_AUDIO, {
          roomId,
          userId: Location.state?.username,
        });

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => {
          socketRef.current.emit(ACTIONS.AUDIO_DATA, {
            roomId,
            audioChunk: event.data,
            userId: Location.state?.username,
          });
        };
        mediaRecorder.start(500);
        // Store mediaRecorder instance to stop it later
        socketRef.current.mediaRecorder = mediaRecorder;
      })
      .catch((err) => {
        console.error("Error accessing microphone:", err);
        toast.error("Failed to start audio sharing");
      });
  };

  const stopAudioSharing = () => {
    if (socketRef.current.mediaRecorder) {
      socketRef.current.mediaRecorder.stop();
      socketRef.current.emit(ACTIONS.STOP_AUDIO, {
        roomId,
        userId: Location.state?.username,
      });
      socketRef.current.mediaRecorder = null;
    }
  };

  console.log(clients);

  return (
    <div className="container-fluid vh-100">
      <div className="row h-100">
        {/* client panel */}
        <div
          className="col-md-2 bg-dark text-light d-flex flex-column h-100"
          style={{ boxShadow: "2px 0px 4px rgba(0, 0, 0, 0.1)" }}
        >
          <h3 className="text-center mt-2 mb-4">SourceSync</h3>

          {/* Client list container */}
          <div className="d-flex flex-column flex-grow-1 overflow-auto">
            <span className="mb-2">Members</span>
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>

          <hr />
          {/* Buttons */}
          <div className="mt-auto ">
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

        {/* Editor panel */}
        <div className="col-md-10 text-light d-flex flex-column h-100 ">
          <Editor
            socketRef={socketRef}
            roomId={roomId}
            onCodeChange={(code) => {
              codeRef.current = code;
            }}
          />
        </div>
        <div className="col-md-3 bg-dark text-light d-flex flex-column h-100">
          {/* <ChatAndAudio
            messages={messages}
            sendMessage={sendMessage}
            startAudioSharing={startAudioSharing}
            stopAudioSharing={stopAudioSharing}
            audioStreams={audioStreams}
          /> */}
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
