import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  const handleClick = (e: any) => {
    navigate(`/${e.target.name}`);
  };

  return (
    <div className="flex flex-grow flex-col justify-center items-center min-h-screen bg-gray-100 p-8">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-10 text-center">
        <h2 className="text-4xl font-bold mb-8 text-gray-800">
          Welcome to File Sharing
        </h2>
        <p className="text-lg text-gray-600 mb-10">
          A secure way to share files directly with others. No uploads, no storage limits.
        </p>
        <div className="space-y-6 w-full max-w-md mx-auto">
          <button
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xl font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-blue-700 transition duration-300 flex items-center justify-center"
            name="createroom"
            onClick={handleClick}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              <path stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11v3M10.5 12.5h3" />
            </svg>
            Create Room
          </button>
          <button
            className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white text-xl font-semibold rounded-lg shadow-md hover:from-green-600 hover:to-green-700 transition duration-300 flex items-center justify-center"
            name="join"
            onClick={handleClick}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
