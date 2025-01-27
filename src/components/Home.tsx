import { useNavigate } from "react-router-dom"

const Home = () => {
    const navigate = useNavigate()

    const handleClick = (e : any) => {
        navigate(`/${e.target.name}`)
    }
    
    return(
        <div className="flex flex-grow flex-col justify-center items-center">
            <button className="bg-lightahhblue w-1/3 py-10 text-2xl mb-10" name="host" onClick={handleClick}>Create Room</button>
            <button className="bg-lightahhblue w-1/3 py-10 text-2xl" name="join" onClick={handleClick}>Join Room</button>
        </div>
    )
}

export default Home