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
    };
    init();

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
        mediaRecorder.start(100);
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

  return (
    <div className="container-fluid vh-100">
      <div className="row h-100">
        {/* client panel */}
        {   
          <Client
            codeRef={codeRef}
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
