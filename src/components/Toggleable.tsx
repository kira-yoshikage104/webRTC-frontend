import { useState } from "react"

const Toggleable = ({ username, userId } : {username : string, userId : string}) => {
    const [showUserId, setShowUserId] = useState<boolean>(false);

    const toggleDisplay = () => {
        setShowUserId(prev => !prev);
    }

    return(
        <span 
      onClick={toggleDisplay} 
      className="cursor-pointer hover:underline transition-colors"
      title={showUserId ? `Click to see username` : `Click to see user ID`}
    >
      {showUserId ? (
        <span className="font-mono text-xs text-gray-600">{userId}</span>
      ) : (
        <span className="font-medium">{username || "Unknown User"}</span>
      )}
    </span>
    );
}

export default Toggleable;