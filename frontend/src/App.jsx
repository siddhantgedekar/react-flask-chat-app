import { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar.jsx'
import ReactMarkdown from 'react-markdown'
import { toast } from 'react-toastify'
import { socket, BACKEND_URL } from './socket'
import './App.css'
// Make sure to import bootstrap JS if you need dropdowns, though we use manual logic here
// import 'bootstrap/dist/css/bootstrap.min.css'; 

function App() {
  // State definitions
  const [filename, setFilename] = useState(null);
  const [activeForm, setActiveForm] = useState("");
  const [qrcode, setQrCode] = useState(null);
  const [joke, setJoke] = useState("");
  const [isJokeLoading, setIsJokeLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [receiverName, setReceiverName] = useState(""); 
  const [input, setInput] = useState(""); 
  const [worldInput, setWorldInput] = useState(""); 
  const [privateMessage, setPrivateMessage] = useState(""); 
  const [messages, setMessages] = useState([]); 
  const [worldMessages, setWorldMessages] = useState([]); 
  const [privateMessageState, setPrivateMessageState] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ai');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pageTheme, setPageTheme] = useState("");

  // Refs
  const aiChatEndRef = useRef(null);
  const worldChatEndRef = useRef(null);
  const privateChatRef = useRef(null);

  // --- SOCKET EFFECT ---
  useEffect(() => {
    if (!username) return; // Don't connect if not logged in

    socket.connect();

    const onConnect = () => {
      socket.emit('join', { username: username });
    };

    // Helper to add messages safely
    const addWorldMsg = (data) => setWorldMessages((prev) => [...prev, data]);
    const addPvtMsg = (data) => setPrivateMessageState((prev) => [...prev, data]);
    const updateUserCount = (data) => setUserCount(data.count);
    const loadHistory = (history) => setWorldMessages(history);

    socket.on('connect', onConnect);
    socket.on('receive_global_message', addWorldMsg);
    socket.on('receive_private_message', addPvtMsg);
    socket.on('user_count_update', updateUserCount);
    socket.on('load_history', loadHistory);

    return () => {
      socket.off('connect', onConnect);
      socket.off('receive_global_message', addWorldMsg);
      socket.off('receive_private_message', addPvtMsg);
      socket.off('user_count_update', updateUserCount);
      socket.off('load_history', loadHistory);
      socket.disconnect();
    };
  }, [username]);

  // --- HANDLERS ---
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userInput = input;
    setInput("");
    
    setMessages(prev => [...prev, { sender: "user", text: userInput }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput, username: username }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { sender: "bot", text: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: "bot", text: "⚠️ Error: Could not connect to server." }]);
    }
    setIsLoading(false);
  };

  const sendWorldMessage = () => {
    if (!worldInput.trim()) return;
    socket.emit('send_global_message', { message: worldInput, username: username });
    setWorldInput("");
  }

  const sendPrivateMessage = () => {
    if(!privateMessage.trim()) return;
    socket.emit('send_private_message', { 'username': username, 'message': privateMessage, 'receiver': receiverName });
    setPrivateMessage("");
  }

  const callQR = async (e) => {
    e.preventDefault();
    if(!filename) return;

    const formData = new FormData();
    formData.append('file', filename);

    try {
      toast.info("Generating QR...");
      const response = await fetch('/qrcode_file', { method: 'POST', body: formData });
      const data = await response.json();
      
      if(response.ok){
        setQrCode(data.qrcode); // Make sure backend key matches this
        toast.success("QR Code Generated!");
      }
    } catch (e) {
      setActiveForm('none');
      toast.error("Failed to generate QR");
    }
  }

  const getTheJoke = async () => {
    try {
      setJoke("");
      setIsJokeLoading(true);
      const response = await fetch("https://icanhazdadjoke.com/", {
        headers: { "Accept" : "application/json" },
      });
      const data = await response.json();
      if(response.ok) setJoke(data.joke);
    } catch (e) {
      toast.error("No jokes today :(");
    } finally {
      setIsJokeLoading(false);
    }
  }

  const setTheme = () => {
    
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    if(!username.trim()) return toast.warning("Enter a name!");

    try {
      const response = await fetch(`${BACKEND_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username }),
      })
      const data = await response.json();
      if(response.ok) {
        setUsername(data.username);
        setIsLoggedIn(true);
        toast.success(`Welcome, ${data.username}!`);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Server connection failed");
    }
  }

  // --- AUTO SCROLL ---
  useEffect(() => {
    if (activeTab === 'ai' && aiChatEndRef.current) aiChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    if (activeTab === 'private' && privateChatRef.current) privateChatRef.current.scrollIntoView({ behavior: "smooth" });
    if (activeTab === 'world' && worldChatEndRef.current) worldChatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, worldMessages, privateMessageState, activeTab]);


  // --- LOGIN VIEW ---
  if (!isLoggedIn) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-dark">
        <div className="card shadow-lg p-4 bg-secondary text-white" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="card-body text-center">
            <h2 className="mb-4">🚀 Sid's Chat</h2>
            <form onSubmit={handleLogin}>
              <input 
                className="form-control form-control-lg mb-3"
                placeholder="Choose a Username..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-info btn-lg w-100 fw-bold">Join Room</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP VIEW ---
  return (
    <div className="container-fluid p-0 d-flex flex-column" style={{ height: '100vh', overflow: 'scroll' }}>
      {/* NAVBAR */}
      <Navbar 
        userCount={userCount}
        joke={joke}
        getTheJoke={getTheJoke}
        isJokeLoading={isJokeLoading}
        onOpenQR={() => setActiveForm("form")} 
      />

      {/* QR MODAL (Centered Overlay) */}
      {activeForm === 'form' && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center qr-modal">
          <div className="card bg-dark text-white border-secondary shadow-lg" style={{ width: '350px' }}>
            <div className="card-header d-flex justify-content-between align-items-center border-secondary">
              <h5 className="m-0 text-success">QR Generator</h5>
              <button className="btn-close btn-close-white" onClick={() => { setActiveForm(""); setQrCode(null); }}></button>
            </div>
            
            <div className="card-body text-center">
              {!qrcode ? (
                <form onSubmit={callQR}>
                  <p className="text-muted small">Upload an image to generate a QR code link.</p>
                  <input 
                    type="file" 
                    className="form-control bg-secondary text-white border-0 mb-3"
                    accept="image/*"
                    onChange={(e) => setFilename(e.target.files[0])}
                  />
                  <div className="d-grid">
                    <button type="submit" className="btn btn-success">Generate</button>
                  </div>
                </form>
              ) : (
                <div className="animate__animated animate__fadeIn">
                  <img src={qrcode} alt="QR Result" className="img-fluid border border-white rounded mb-3" />
                  <div className="d-grid">
                    <button className="btn btn-outline-light" onClick={() => { setQrCode(null); setFilename(null); }}>Generate Another</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CHAT AREA */}
      <div className="container mt-3" style={{ flex: 1 }}>
        
        {/* TABS */}
        <ul className="nav nav-pills nav-fill mb-3 bg-dark rounded p-1">
          <li className="nav-item">
            <button className={`nav-link ${activeTab === 'world' ? 'active bg-success' : 'text-white'}`} onClick={() => setActiveTab('world')}>🌍 World</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${activeTab === 'private' ? 'active bg-warning text-dark' : 'text-white'}`} onClick={() => setActiveTab('private')}>🔒 Private</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${activeTab === 'ai' ? 'active bg-info text-dark' : 'text-white'}`} onClick={() => setActiveTab('ai')}>🤖 AI Chat</button>
          </li>
        </ul>

        {/* CHAT BOX CARD */}
        <div className="card bg-dark border-secondary h-100">
          
          {/* 1. WORLD CHAT */}
          {activeTab === 'world' && (
            <>
              <div className="card-body chat-history p-3">
                {worldMessages.map((msg, i) => (
                  <div key={i} className={`d-flex flex-column ${msg.username === username ? 'align-items-end' : 'align-items-start'}`}>
                    <small className="text-white mb-1">{msg.username === username ? 'You' : msg.username} <span style={{fontSize: '0.7em'}}>{msg.clock}</span></small>
                    <div className={`p-2 px-3 rounded message-bubble ${msg.username === username ? 'bg-success text-white' : 'bg-light text-dark'}`}>
                      <ReactMarkdown>{msg.message}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                <div ref={worldChatEndRef} />
              </div>
              <div className="card-footer bg-transparent border-0">
                <div className="input-group">
                  <input 
                    className="form-control"
                    placeholder="Message the world..."
                    value={worldInput}
                    onChange={(e) => setWorldInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendWorldMessage()}
                  />
                  <button className="btn btn-success" onClick={sendWorldMessage}>Send</button>
                </div>
              </div>
            </>
          )}

          {/* 2. PRIVATE CHAT */}
          {activeTab === 'private' && (
            <>
              <div className="card-body chat-history p-3">
                {privateMessageState.map((msg, i) => (
                  <div key={i} className={`d-flex flex-column ${msg.username === username ? 'align-items-end' : 'align-items-start'}`}>
                    <small className="text-white mb-1">{msg.username === username ? 'You' : msg.username} <span style={{fontSize: '0.7em'}}>{msg.clock}</span></small>
                    <div className={`p-2 px-3 rounded message-bubble ${msg.username === username ? 'bg-warning text-dark' : 'bg-light text-dark'}`}>
                      <ReactMarkdown>{msg.message}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                <div ref={privateChatRef} />
              </div>
              <div className="card-footer bg-transparent border-0">
                <div className="input-group">
                  <input 
                    className="form-control" 
                    style={{maxWidth: '120px'}}
                    placeholder="To User..."
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                  />
                  <input 
                    className="form-control"
                    placeholder="Private message..."
                    value={privateMessage}
                    onChange={(e) => setPrivateMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendPrivateMessage()}
                  />
                  <button className="btn btn-warning" onClick={sendPrivateMessage}>Send</button>
                </div>
              </div>
            </>
          )}

          {/* 3. AI CHAT */}
          {activeTab === 'ai' && (
            <>
              <div className="card-body chat-history p-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`d-flex flex-column ${msg.sender === "user" ? 'align-items-end' : 'align-items-start'}`}>
                    <div className={`p-2 px-3 rounded message-bubble ${msg.sender === "user" ? 'bg-info text-dark' : 'bg-secondary text-white'}`}>
                      <strong>{msg.sender === "user" ? "You" : "AI"}: </strong>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {isLoading && (
                   <div className="text-start">
                     <div className="bg-secondary p-2 rounded d-inline-block">
                        <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                     </div>
                   </div>
                )}
                <div ref={aiChatEndRef} />
              </div>
              <div className="card-footer bg-transparent border-0">
                <div className="input-group">
                  <input 
                    className="form-control"
                    placeholder="Ask AI something..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <button className="btn btn-info" onClick={sendMessage}>Ask</button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

export default App