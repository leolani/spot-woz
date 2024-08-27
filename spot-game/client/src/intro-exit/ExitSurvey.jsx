import React from "react";
import {Button} from "../components/Button";

const claim = (e) => {
    e.preventDefault();
    window.location.href='https://nos.nl/';
};

export function ExitSurvey({ next }) {
  return (
      <div className="exit">
          <p className="intropara" >Thank you for playing this game! You will now be led back to Prolific to receive your payment.</p>
          <Button handleClick={claim} autoFocus>
              <p>Claim your payment</p>
          </Button>
      </div>
  );
}
