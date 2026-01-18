import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'react-toastify'
import { socket, BACKEND_URL } from './socket'
import './App.css'

// connect to server OUTSIDE of the component so it doesn't reconnect, everytime you type

function App() {
  // filename state
  const [filename, setFilename] = useState(null);
  const [activeForm, setActiveForm] = useState("");
  const [qrcode, setQrCode] = useState(null);

  // state for joke
  const [joke, setJoke] = useState("");
  const [isJokeLoading, setIsJokeLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [receiverName, setReceiverName] = useState(""); // for private messaging

  // Input states for different chat types
  const [input, setInput] = useState(""); // AI chat input
  const [worldInput, setWorldInput] = useState(""); // world chat input
  const [privateMessage, setPrivateMessage] = useState(""); // private chat input
  // Message histories for different chat types
  const [messages, setMessages] = useState([]); // AI chat message history
  const [worldMessages, setWorldMessages] = useState([]); // World chat message history
  const [privateMessageState, setPrivateMessageState] = useState([]); // private message history

  // Loading and tab states
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ai');

  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Refs are ONLY for scrolling now, not for hiding/showing
  const aiChatEndRef = useRef(null);
  const worldChatEndRef = useRef(null);
  const privateChatRef = useRef(null);

  // socket listener (the ear)
  useEffect(() => {
    socket.connect();

    const onConnect = () => {
      // 4. CRITICAL: Tell Server to put us in our Private Room
      socket.emit('join', { username: username });
    };

    const onGlobalMessage = (data) => {
      setWorldMessages((prev) => [...prev, data]);
    };

    const onPrivateMessage = (data) => {
      setPrivateMessageState((prev) => [...prev, data]);
    };

    const onUserCount = (data) => {
      setUserCount(data.count);
    };

    const onLoadHistory = (history) => {
      setWorldMessages(history);
    };

    // Listeners
    socket.on('connect', onConnect);
    socket.on('receive_global_message', onGlobalMessage);
    socket.on('receive_private_message', onPrivateMessage);
    socket.on('user_count_update', onUserCount);
    socket.on('load_history', onLoadHistory);

    return () => { // cleanup on unmount
      socket.off('connect', onConnect);
      socket.off('receive_global_message', onGlobalMessage);
      socket.off('receive_private_message', onPrivateMessage);
      socket.off('user_count_update', onUserCount);
      socket.off('load_history', onLoadHistory);
      
      // Kill connection when user logs out or refreshes
      socket.disconnect();
    };
  }, [username]);

  const sendMessage = async () => { // function to send message to AI server
    const userInput = input; // store current input
    setInput(""); // clear input box

    if (!userInput.trim()) return;
    
    setMessages(prev => [...prev, { sender: "user", text: userInput }]); // Add USER message for AI chat
    setIsLoading(true); // loading...

    try { // handle error and fetch to backend
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput }),
      });
      const data = await response.json(); // wait for response
      setMessages(prev => [...prev, { sender: "bot", text: data.reply }]); // add bot's response to messages state

    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, { sender: "bot", text: "⚠️ Error: Could not connect to server." }]);
    }
    setIsLoading(false);
  };

  // Function message the world
  const sendWorldMessage = () => {
    if (!worldInput.trim()) return; // don't send empty messages

    socket.emit('send_global_message', { message: worldInput, username: username }); // send message to python/server via socket

    setWorldInput(""); // clear the input box of world chat
  }

  // Function to send private message
  const sendPrivateMessage = () => {
    if(!privateMessage.trim()) return; // don't send empty message

    socket.emit('send_private_message', { 'username': username, 'message': privateMessage, 'receiver': receiverName });

    setPrivateMessage(""); // clear input box
  }

  // Function to generate QR codes
  const formVisibility = () => {
    // logic to create qr codes
    // on call, set activeForm === 'form'
    setActiveForm("form");
  }

  const callQR = async (e) => {
    e.preventDefault(); // prevent refresh
    if(!filename) return; // no sending empty value/data

    // files are handled using browsers' FormData
    const formData = new FormData();
    formData.append('file', filename);

    try {
      const response = await fetch('/qrcode_file', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json();
      console.log("Server says: ", data);
      
      if(response.ok){
        // setActiveForm('none');
        setQrCode(data.qrcode);
        toast.success("Generating QR Code.. please wait!!");
      }
    } catch (e) {
      setActiveForm('none');
      toast.error("OOPS!! failed to generate QR Code..")
      console.error("Upload failed ", e);
    }
  }

  const getTheJoke = async () => {
    try {
      setJoke("");
      setIsJokeLoading(true);
      // This API returns: { type: "general", setup: "Why did...", punchline: "Because..." }
      const response = await fetch("https://icanhazdadjoke.com/", {
        headers: { "Accept" : "application/json" },
      });

      const data = await response.json();

      if(response.ok) {
        setJoke(data.joke);
        setIsJokeLoading(false);
        console.log("Joke is: ",data.joke);
      }
    } catch (e) {
      console.log("Error: ", e.error);
      alert("OOPS!! Error fetching a joke..")
    }
  }

  useEffect(() => { // Auto-Scroll to bottom whenever messages change
    if (activeTab === 'ai' && aiChatEndRef.current) aiChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    if (activeTab === 'private' && privateChatRef.current) privateChatRef.current.scrollIntoView({ behavior: "smooth" });
    if (activeTab === 'world' && worldChatEndRef.current) worldChatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, worldMessages, privateMessageState, activeTab]);

  // Function to handle login
  async function handleLogin(e) {
    e.preventDefault(); // prevent page refresh
    if(!username.trim()) return alert("Enter a name!"); // validation alert prompt for user

    try { // call backend login endpoint
      const response = await fetch(`${BACKEND_URL}/login`, { // vite.config automatically redirects/forwards it to endpoint/API
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username }),
      })
      const data = await response.json(); // wait and then parse the json response

      if(response.ok) { // success!. Save username to state
        setUsername(data.username); // set username
        setIsLoggedIn(true); // mark logged in 'true'
        toast.success(data.message +" "+ data.username); // show success message
      } else {
        alert(data.error); // show error message
      }
    } catch (error) { // handle error
      console.log("Login error:", error);
      alert("Server error. Is Python running?");
    }
  }

  if (!isLoggedIn) { // if isLoggedIn == false, we won't show chat UI (ik it's basic, but works)
    return (
      <div style={{
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#282c34',
        color: 'white'
      }}>
        <form onSubmit={handleLogin} style={{
          padding: '2rem', 
          border: '1px solid #444', 
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <h2>Welcome to Sid's Chat</h2>
          <input 
            type="text" 
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '10px', fontSize: '1rem', marginBottom: '1rem' }}
          />
          <br />
          <button type="submit" style={{
            padding: '10px 20px', 
            cursor: 'pointer', 
            backgroundColor: '#61dafb', 
            border: 'none', 
            fontWeight: 'bold', 
            color: 'black'
          }}>
            Join Chat
          </button>
          <br />
          <small style={{fontFamily: 'monospace', fontWeight: 'bold', color: 'lightgrey'}}>Don't forget your username</small>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-container App">
      <header>
        <nav>
          <h1>RexOrion</h1>

          <small className='joke'>
            wanna hear a joke!!
            <div className='joke-container'>
              <br />
              <button className='success joke-btn' onClick={getTheJoke}>click</button>

              <h4 className='joke-show'>
                {joke}
                {isJokeLoading && <div className="message bot"><small className="dot"></small><small className="dot"></small><small className="dot"></small></div>}
              </h4>
            </div>
          </small>

          <div className="navbar-tools">
            <button className='tools-container'>Tools</button>
            <ul className="tools">
              <li onClick={formVisibility}>Generate QR Code</li>
            </ul>
          </div>
          <small>Online {userCount}</small> {/*show user count*/}
        </nav>
      </header>

      {/* UNIFIED FILE UPLOAD & QR RESULT MODAL */}
      <div className="fileform" style={{ 
          border: activeForm === 'form' ? '1px solid grey' : 'none',
          display: activeForm === 'form' ? 'block' : 'none', // Hides entire box if not active
          margin: '5px', 
          padding: '15px',
          borderRadius: '10px',
          backgroundColor: '#333' // Added background so it pops out
      }}>
        
        {/* LOGIC: IF NO QR CODE, SHOW FORM. IF QR CODE EXISTS, SHOW IMAGE */}
        {!qrcode ? (
          // --- VIEW 1: UPLOAD FORM ---
          <form onSubmit={callQR}>
            <h2 style={{ padding: '5px', color: 'white', marginTop: 0}}>Upload File</h2>
            <small style={{color: '#ccc'}}>Supported: .jpg, .png</small>
            <br />
            
            <input 
              type="file" 
              accept="image/*" // Good practice: limits selection to images
              onChange={(e) => setFilename(e.target.files[0])} 
              style={{padding: '5px', margin: '15px 0px', color: 'white'}}
            />
            
            <br />
            <div style={{display: 'flex', gap: '10px'}}>
              <button type='submit' className='success' style={{flex: 1}}>Generate QR</button>
              <button type='button' className='danger' onClick={() => setActiveForm('none')}>Cancel</button>
            </div>
          </form>
        ) : (
          // --- VIEW 2: QR RESULT ---
          <div style={{ textAlign: 'center', color: 'white' }}>
            <h2 style={{color: '#4caf50'}}>Success!</h2>
            <p>Scan this to view your file:</p>
            
            <img 
              src={qrcode} 
              alt="Generated QR" 
              style={{ 
                width: '200px', 
                height: '200px', 
                borderRadius: '10px', 
                border: '5px solid white',
                margin: '10px 0' 
              }} 
            />
            
            <br />
            <button 
              className='danger' 
              style={{ width: '100%', marginTop: '10px' }}
              onClick={() => {
                setQrCode(null);      // Clear the image
                setFilename(null); // Clear the file
                setActiveForm('none'); // Close the box
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* TABS BUTTONS */}
      <section className="tabs-container">
        <button className={`world-chat ${activeTab === 'world' ? 'active' : ''}`} onClick={() => setActiveTab('world')}>World</button>
        <button className={`private-chat ${activeTab === 'private' ? 'active' : ''}`} onClick={() => setActiveTab('private')}>Private</button>
        <button className={`ai-chat ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI</button>
      </section>

      {/* --- AI SECTION --- */}
      {/* We control visibility here using State, not manual DOM manipulation */}
      <section style={{ display: activeTab === 'ai' ? 'block' : 'none' }}>
        <div className="chat-history ai">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender} message-bubble`}>
              <strong>{msg.sender === "user" ? "You" : "AI"}:</strong>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          ))}
          {isLoading && <div className="message bot"><small className="dot"></small><small className="dot"></small><small className="dot"></small></div>}
          {/* Invisible element to auto-scroll to */}
          <div ref={aiChatEndRef} />
        </div>

        <div className="input-area">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask AI something..."
            className='user-input'
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </section>

      {/* --- WORLD SECTION --- */}
      <section style={{ display: activeTab === 'world' ? 'block' : 'none' }}>
        <div className="chat-history world">
          {worldMessages.map((msg, index) => {
            const isMe = msg.username === username; // is the sender me of someone else?

            return (
            <div key={ index } 
              className='message user message-bubble' 
              style={{ background: isMe ? '#dcf8c6' : '#ffffff', color:'black', alignSelf: isMe ? 'flex-end' : 'flex-start', borderRadius: '10px', textAlign: "left" }}>
                <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '4px', fontWeight: 'bold' }}>{ isMe ? "You" : msg.username } {msg.clock}</div>
                <ReactMarkdown>{msg.message}</ReactMarkdown>
            </div>
          );
          })}
          <div ref={worldChatEndRef} />
        </div>

        <div className="input-area">
          <input value={worldInput} 
            onChange={(e) => setWorldInput(e.target.value)}
            onKeyPress={ (e) => e.key === 'Enter' && sendWorldMessage()}
            placeholder="Message the world..."
            className='user-input'
          />
          <button onClick={sendWorldMessage}>Broadcast</button>
        </div>
      </section>

      {/* Private Message Section */}
      <section style={{ display: activeTab === 'private' ? 'block' : 'none' }}>
        <div className="chat-history private">
          {privateMessageState.map((msg, index) => {
            const isMe = msg.username === username; // is the sender me of someone else?

            return (
            <div key={ index } 
              className='message user message-bubble' 
              style={{ background: isMe ? '#dcf8c6' : '#ffffff', color:'black', alignSelf: isMe ? 'flex-end' : 'flex-start', borderRadius: '10px', textAlign: "left" }}>
                <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '4px', fontWeight: 'bold' }}>{ isMe ? "You" : msg.username } { msg.clock }</div>
                <ReactMarkdown>{ msg.message }</ReactMarkdown>
            </div>
          );
          })}
          <div ref={privateChatRef} />
        </div>

        <div className="input-area">
          <label htmlFor="pvt_msg">
            <input value={receiverName} 
            type="text" 
            placeholder='To...' 
            onChange={(e) => setReceiverName(e.target.value)}
            className='user-input'/>
          </label>
          <input value={privateMessage} 
            onChange={(e) => setPrivateMessage(e.target.value)}
            onKeyPress={ (e) => e.key === 'Enter' && sendPrivateMessage()}
            placeholder="Message privately..."
            className='user-input' 
            id="pvt_msg"
          />
          <button onClick={sendPrivateMessage}>Message</button>
        </div>
      </section>
    </div>
  )
}

export default App