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
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);

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

      // listening for disconnected
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });
    };
    init();

    return () => {
      socketRef.current?.disconnect();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
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
        streamRef.current = stream;
        socketRef.current.emit(ACTIONS.START_AUDIO, {
          roomId,
          userId: Location.state?.username,
        });
        var mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        var audioChunks = [];

        mediaRecorder.addEventListener("dataavailable", function (event) {
          audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener("stop", function () {
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

          mediaRecorder.start();
          setTimeout(function () {
            mediaRecorder.stop();
          }, 1000);
        });

        mediaRecorder.start();
        setTimeout(function () {
            mediaRecorder.stop();
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
    if (streamRef.current) {
      // Stop all tracks in the stream
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Emit event to inform other clients that audio sharing has stopped
    socketRef.current.emit(ACTIONS.STOP_AUDIO, {
      roomId,
      userId: Location.state?.username,
    });

    // Update local client state
    setClients((prev) =>
      prev.map((client) =>
        client.username === Location.state?.username
          ? { ...client, isMuted: true }
          : client
      )
    );

    toast.success("Audio sharing stopped");
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