import React, {useState, useEffect} from "react";

export function SpotExposure({duration, children}) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        let hideTimer = isVisible && setTimeout(() => setIsVisible(false), 5000);
        return () => hideTimer && clearTimeout(hideTimer);
    }, [isVisible]);

    const hidden = (<div className="positions">
            <button id="show" className="show" onClick={() => setIsVisible(true)}>
                Laat het plaatje zien
            </button>
        </div>);

    return (<div>{isVisible ? children : hidden}</div>);
}
