import React from "react";
import Home from "../Home/home";
import Seo from "../../seo/Seo";

function Reels() {
  return (
    <>
      <Seo
        title="Reels"
        description="Xabarchi reels uslubidagi postlar oqimi."
      />
      <div>
        <Home enableSeo={false} />
      </div>
    </>
  );
}

export default Reels;
