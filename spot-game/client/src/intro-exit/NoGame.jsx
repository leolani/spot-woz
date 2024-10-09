import React from "react";
import {Button} from "../components/Button";
import {useGame} from "@empirica/core/player/classic/react";
import {info} from "@empirica/core/console";

export function NoGame({next}) {
    return (
        <div className="exit">
            <p className="intropara">Unfortunately there is no free spot available.</p>
        </div>
    );
}
