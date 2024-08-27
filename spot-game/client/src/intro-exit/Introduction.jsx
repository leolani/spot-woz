import React from "react";
import { Button } from "../components/Button";
import Main1 from "../assets/images/Main1_new_hoofd.png";
import Main2 from "../assets/images/Main2_new_hoofd.png";
import Main3 from "../assets/images/Main3_hoofd.png";

export function Introduction({ next }) {
  return (
      <div className="introduction">
          Welcome! In this experiment, you will be playing a game with an intelligent agent called Robin.
          <p className="intropara">
              In each round, you will see the three figures shown below. They will be in a picture with other figures. Robin also sees this picture, but the figures are shown in a different order than in your picture. You will go through each position in a left-to-right order, and describe the figure in that position to Robin. Robin will then tell you the position of this figure in his picture. You can then enter this position in a menu, and continue with the next figure. A round is finished when you have filled in all the positions for all the figures. There are 15 rounds in total.
          </p>

          <div className="faces">
              <div className="examples">
                  <img src={Main1} className="faceimg" />
              </div>
              <div className="examples">
                  <img src={Main2} className="faceimg" />
              </div>
              <div className="examples">
                  <img src={Main3} className="faceimg" />
              </div>
          </div>
          <p className="intropara">
              You can communicate with each other through a chat window. When you hit send on your message, you must wait for Robin's response before you can type again. Keep this in mind, as it means you need to send your entire message in one go.
          </p>
          <p className="intropara">The game will start with a practice round to get familiar with the game. Please press this button below to continue to the practice round. Robin will then further explain the game to you.</p>
          <Button handleClick={next} autoFocus>
              <p>Continue</p>
          </Button>
      </div>
    );
}
