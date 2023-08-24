// import { Consent } from "@empirica/core/player/react";
//
// export function SpotConsent({ onConsent }) {
//   return (
//     <Consent
//       title="Do you consent?"
//       text="It's all good, mate."
//       buttonText="OK"
//     />
//   );
// }

export function SpotConsent({ onConsent }) {
  return (
    <div>
      <div>Do you consent?</div>
      <div>
        <button type="button" onClick={onConsent}>
          Yes!
        </button>
      </div>
    </div>
  );
}