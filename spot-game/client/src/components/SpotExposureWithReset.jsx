import React, {useState, useEffect} from "react";

export function SpotExposure({duration, children}) {
    const [isVisible, setIsVisible] = useState(true);
    const [hideTimer, setHideTimer] = useState();

    const startHideTimer = (timeout) => {
        hideTimer && clearTimeout(hideTimer);
        setHideTimer(isVisible && setTimeout(() => setIsVisible(false), timeout));
        console.log("set timer", timeout);
    }

    useEffect(() => {
        startHideTimer(duration);
        return () => hideTimer && clearTimeout(hideTimer);
    }, [isVisible]);

    const hidden = (<div className="positions">
            <button id="show" className="show" onClick={() => setIsVisible(true)}>
                Laat het plaatje zien
            </button>
        </div>);

    return (
        <div onClick={(e) => isVisible && startHideTimer(2000)}>
            {isVisible ? children : hidden}
        </div>
    );
}
