import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface ToggleSwitchProps {
  isPublic: boolean;
  setIsPublic: (value: boolean) => void;
}

const ToggleSwitch = ({ isPublic, setIsPublic }: ToggleSwitchProps) => {
  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => setIsPublic(!isPublic)}
        className={`w-12 h-7 flex items-center rounded-full p-1 transition ${
          isPublic ? "bg-blue-500" : "bg-gray-300"
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow-md transform transition ${
            isPublic ? "translate-x-5" : "translate-x-0"
          }`}
        ></div>
      </button>
      <span className="text-black font-normal">
        {isPublic ? "Public" : "Private"}
      </span>
    </div>
  );
};

interface DropdownProps {
  options: string[];
  selected: string;
  setSelected: (value: string) => void;
}

const Dropdown = ({ options, selected, setSelected }: DropdownProps) => {
  return (
    <div className="w-full">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

const CreateRoom = () => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState<string>("");
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [selectedGenre, setSelectedGenre] = useState<string>("Select a genre");
  const [username, setUsername] = useState<string>("");

  const handleClick = () => {
    if (!roomName.trim()) {
      alert("Room name is required.");
      return;
    }
    if (selectedGenre === "Select a genre") {
      alert("Please select a valid genre.");
      return;
    }
    const data = {
      roomName: roomName,
      isPublic: isPublic,
      genre: selectedGenre,
      username
    };
    navigate("/host", { state: data });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-100">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-6 mb-8">
        <h1 className="text-3xl font-semibold mb-4">Host a room</h1>
        <div className="mb-5">
          <label
            htmlFor="roomName"
            className="block text-lg font-semibold mb-1"
          >
            Room Name
          </label>
          <input
            type="text"
            id="roomName"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="w-full p-2 border-2"
            placeholder="Enter a name for your room"
            required
          />
          <p className="text-sm font-light">
            This will be visible to others if your room is public.
          </p>
        </div>
        <div className="mb-5">
          <label className="block text-lg font-semibold mb-1">
            Room Visibility
          </label>
          <ToggleSwitch isPublic={isPublic} setIsPublic={setIsPublic} />
          <p className="text-sm font-light">
            Public rooms are visible in the public rooms list. Private rooms can
            only be joined with a room ID.
          </p>
        </div>
        <div className="mb-5">
          <label className="block text-lg font-semibold mb-1">Room Genre</label>
          <Dropdown
            options={["Select a genre", "Music", "Movies & Videos"]}
            selected={selectedGenre}
            setSelected={setSelectedGenre}
          />
          <p className="text-sm font-light">
            This helps users find the type of content they're looking for.
          </p>
        </div>
        <div className="form-group">
          <label htmlFor="username">Display Name:</label>
          <input
            type="text"
            id="username"
            name="username"
            placeholder="Enter your display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-4 py-2 mb-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          className="bg-blue-500 text-white w-full py-4 text-xl font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300 ease-in-out"
          onClick={handleClick}
        >
          Create Room
        </button>
      </div>
    </div>
  );
};

export default CreateRoom;
