import React from "react";
import "./create.css";
import { FaPlus } from "react-icons/fa";

function Create() {
  return (
    <div className="create-post">
      <div className="create-post_item">
        <div className="create-post_item__icon">
          <FaPlus />
        </div>
        <div className="create-post_item__content">
          <h3>Post yaratish</h3>
          <p>Surat ulashing yoki biron narsa yozing</p>
        </div>
      </div>
    </div>
  );
}

export default Create;
