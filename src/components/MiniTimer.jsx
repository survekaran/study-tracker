import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatTime } from "../utils/time";

export default function MiniTimer() {
    const [isRunning, setIsRunning] = useState(false);
    const [startTime, setStartTime] = useState(null);
    const [elapsed, setElapsed] = useState(0);
    const [pipWindow, setPipWindow] = useState(null);

    // Load from localStorage
    useEffect(() => {
        const data = JSON.parse(localStorage.getItem("studyTimer"));

        if (data?.isRunning) {
            setStartTime(data.startTime);
            setIsRunning(true);
        }
    }, []);

    // Timer logic
    useEffect(() => {
        let interval;

        if (isRunning && startTime) {
            interval = setInterval(() => {
                setElapsed(Date.now() - startTime);
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [isRunning, startTime]);

    // Sync across tabs
    useEffect(() => {
        const sync = () => {
            const data = JSON.parse(localStorage.getItem("studyTimer"));

            if (data?.isRunning) {
                setStartTime(data.startTime);
                setIsRunning(true);
            } else {
                setIsRunning(false);
                setElapsed(0);
                if (pipWindow) pipWindow.close();
            }
        };

        window.addEventListener("storage", sync);
        window.addEventListener("studyTimerLocalUpdate", sync);
        return () => {
            window.removeEventListener("storage", sync);
            window.removeEventListener("studyTimerLocalUpdate", sync);
        };
    }, [pipWindow]);

    const stopTimer = () => {
        localStorage.setItem("studyTimer", JSON.stringify({
            isRunning: false
        }));
        setIsRunning(false);
        if (pipWindow) pipWindow.close();
        window.dispatchEvent(new Event('stopStudyTimer'));
    };

    const togglePip = async () => {
        if (pipWindow) {
            pipWindow.close();
            return;
        }

        if (!("documentPictureInPicture" in window)) {
            alert("Your browser does not support the floating window feature. Try using Chrome or Edge!");
            return;
        }

        try {
            const pip = await window.documentPictureInPicture.requestWindow({
                width: 260,
                height: 80,
            });

            // Copy all styles to the new window so it looks identical
            [...document.styleSheets].forEach((styleSheet) => {
                try {
                    const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
                    const style = document.createElement("style");
                    style.textContent = cssRules;
                    pip.document.head.appendChild(style);
                } catch (e) {
                    const link = document.createElement("link");
                    link.rel = "stylesheet";
                    link.type = styleSheet.type;
                    link.media = styleSheet.media;
                    link.href = styleSheet.href;
                    pip.document.head.appendChild(link);
                }
            });

            pip.addEventListener("pagehide", () => {
                setPipWindow(null);
            });

            pip.document.body.className = "flex items-center justify-center h-full m-0 bg-transparent";
            setPipWindow(pip);
        } catch (error) {
            console.error("Failed to open PiP:", error);
        }
    };

    if (!isRunning) return null;

    const timerContent = (
        <div className="bg-black text-white px-4 py-2 rounded-xl shadow-lg flex items-center justify-between gap-4 w-full">
            <span className="font-mono text-lg">
                {formatTime(Math.floor(elapsed / 1000))}
            </span>

            <div className="flex gap-2">
                <button 
                    onClick={togglePip}
                    className="bg-zinc-800 text-xs px-2 py-1 rounded hover:bg-zinc-700 font-semibold"
                    title={pipWindow ? "Return to page" : "Pop out to floating window"}
                >
                    {pipWindow ? "Unpop" : "Pop Out"}
                </button>
                <button
                    onClick={stopTimer}
                    className="bg-red-500 px-3 py-1 rounded-lg text-sm font-semibold hover:bg-red-600"
                >
                    Stop
                </button>
            </div>
        </div>
    );

    // If popped out, render into the PiP window's body instead of the main page
    if (pipWindow) {
        return createPortal(timerContent, pipWindow.document.body);
    }

    return (
        <div className="fixed top-4 right-4 z-50">
            {timerContent}
        </div>
    );
}