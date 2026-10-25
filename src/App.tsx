import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CommuterHome from './screens/commuter/CommuterHome'
import DriverHome from './screens/driver/DriverHome'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CommuterHome />} />
        <Route path="/driver" element={<DriverHome />} />
      </Routes>
    </BrowserRouter>
  )
}
