// Copied from Tremor Raw (Apache License 2.0, https://github.com/tremorlabs/tremor), restyled with LOGINA tokens.

import * as React from "react"

export const useOnWindowResize = (handler: () => void) => {
  React.useEffect(() => {
    const handleResize = () => {
      handler()
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [handler])
}
