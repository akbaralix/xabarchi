import React from "react";

function Error({ message }) {
  return (
    <div className="error-contain">
      <p>{message}</p>
    </div>
  );
}

export default Error;
