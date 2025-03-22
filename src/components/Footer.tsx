const Footer = () => {
    return (
        <footer className="bg-gray-800 text-white mt-auto">
            <div className="container mx-auto px-4 py-6">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="mb-4 md:mb-0">
                        <p className="text-sm">&copy; 2023 File Sharing App. All rights reserved.</p>
                    </div>
                    <div className="flex space-x-4">
                        <a href="#" className="text-gray-400 hover:text-white transition duration-300">
                            Privacy Policy
                        </a>
                        <a href="#" className="text-gray-400 hover:text-white transition duration-300">
                            Terms of Service
                        </a>
                        <a href="#" className="text-gray-400 hover:text-white transition duration-300">
                            Contact Us
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}

export default Footer
