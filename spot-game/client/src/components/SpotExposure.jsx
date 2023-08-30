import React, {useState, useEffect} from "react";

export function SpotExposure({duration, children}) {
    const [isVisible, setIsVisible] = useState(true);

    const hideTimer = setTimeout(() => setIsVisible(false), duration);
    const showContent = () => {
        setIsVisible(true);
        clearTimeout(hideTimer);
    };

    useEffect(() => clearTimeout(hideTimer), []);

    const hidden = (
        <div className="positions">
            <button id="show" className="show" onClick={showContent}>
                Laat het plaatje zien
            </button>
        </div>
    );

    return (
        <div>{isVisible ? children : hidden}</div>
    );
}
