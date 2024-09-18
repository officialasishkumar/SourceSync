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
  const codeRef = useRef(null);
  const [clients, setClients] = useState([]);

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
    };
    init();

    console.log(socketRef.current);
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  if (!Location.state) {
    return <Navigate to="/" />;
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success(`Room ID copied`);
    } catch (error) {
      console.log(error);
      toast.error("Unable to copy the Room ID");
    }
  };

  const leaveRoom = async () => {
    navigate("/");
  };

  const startAudioSharing = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        socketRef.current.emit(ACTIONS.START_AUDIO, {
          roomId,
          userId: Location.state?.username,
        });
        var madiaRecorder = new MediaRecorder(stream);
        var audioChunks = [];

        madiaRecorder.addEventListener("dataavailable", function (event) {
          audioChunks.push(event.data);
        });

        madiaRecorder.addEventListener("stop", function () {
          var audioBlob = new Blob(audioChunks);
          audioChunks = [];
          var fileReader = new FileReader();
          fileReader.readAsDataURL(audioBlob);
          fileReader.onloadend = function () {
            var base64String = fileReader.result;
            socketRef.current.emit(ACTIONS.AUDIO_DATA, {
              roomId,
              audioChunk: base64String,
              userId: Location.state?.username,
            });
          };

          madiaRecorder.start();
          setTimeout(function () {
            madiaRecorder.stop();
          }, 1000);
        });

        madiaRecorder.start();
        setTimeout(function () {
            madiaRecorder.stop();
        }, 1000);      
        setClients((prev) =>
          prev.map((client) =>
            client.username === Location.state?.username
              ? { ...client, isMuted: false }
              : client
          )
        );
      })
      .catch((error) => {
        console.error("Error capturing audio.", error);
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
      setClients((prev) =>
        prev.map((client) =>
          client.username === Location.state?.username
            ? { ...client, isMuted: true }
            : client
        )
      );
    }
  };

  return (
    <div className="container-fluid vh-100">
      <div className="row h-100">
        {/* client panel */}
        {
          <Client
            codeRef={codeRef}
            clients={clients}
            setClients={setClients}
            copyRoomId={copyRoomId}
            leaveRoom={leaveRoom}
            socketRef={socketRef}
            stopAudioSharing={stopAudioSharing}
            startAudioSharing={startAudioSharing}
          />
        }

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
      </div>
    </div>
  );
}

export default EditorPage;
