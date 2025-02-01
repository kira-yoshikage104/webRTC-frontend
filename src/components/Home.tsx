import { useNavigate } from "react-router-dom"

const Home = () => {
    const navigate = useNavigate()

    const handleClick = (e : any) => {
        navigate(`/${e.target.name}`)
    }
    
    return(
        <div className="flex flex-grow flex-col justify-center items-center bg-gray-100 p-8">
            <h2 className="text-4xl font-bold mb-8 text-gray-800">Welcome to File Sharing</h2>
            <div className="space-y-6 w-full max-w-md">
                <button 
                    className="bg-blue-500 text-white w-full py-4 text-xl font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300 ease-in-out" 
                    name="host" 
                    onClick={handleClick}
                >
                    Create Room
                </button>
                <button 
                    className="bg-green-500 text-white w-full py-4 text-xl font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300 ease-in-out" 
                    name="join" 
                    onClick={handleClick}
                >
                    Join Room
                </button>
            </div>
        </div>
    )
}

export default Home