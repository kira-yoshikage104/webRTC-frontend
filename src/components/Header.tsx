
const Header = () => {
    return (
        <header className="bg-blue-600 text-white shadow-md">
            <div className="container mx-auto px-4 py-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">File Sharing</h1>
                <nav>
                    <ul className="flex space-x-4">
                        <li><a href="/" className="hover:text-blue-200 transition duration-300">Home</a></li>
                        <li><a href="/host" className="hover:text-blue-200 transition duration-300">Host</a></li>
                        <li><a href="/join" className="hover:text-blue-200 transition duration-300">Join</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    )
}


export default Header