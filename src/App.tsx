import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './components/Home'
import Host from './components/Host'
import Join from './components/Join'
import './index.css'
function App() {
  return(
    <Routes>
      <Route path='/' element={<Layout />} >

        <Route index element={<Home />} />

        <Route path='room' element={<Host />} />
        <Route path='join' element={<Join />} />

      </Route>
    </Routes>
  )
}

export default App
