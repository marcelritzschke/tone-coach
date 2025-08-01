"use client";

import { useEffect } from "react";

function BootstrapClient() {
  useEffect(() => {
    /* eslint-disable */
    require("bootstrap/dist/js/bootstrap.bundle.min.js");
    /* eslint-enable */
  }, []);

  return null;
}

export default BootstrapClient;