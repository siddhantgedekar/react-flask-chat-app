# import necessary modules
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_session import Session
from dotenv import load_dotenv
import ollama

# create Flask app
app = Flask(__name__)
# CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}}) # adjust origin as needed
# configure security key
app.config['SECRET_KEY'] = "mysecretkey" # in production, load from environment variable
CORS(app) # enable CORS for all origins

socketio = SocketIO(app, cors_allowed_origins="*") # initialize socketio

# configure session
app.config['SESSION_TYPE'] = 'filesystem'
Session(app) # initialize session

# configure AI model
model_name = 'qwen2:0.5b'  # specify the model name

# implementing memory of AI using Global variable for memory
user_sessions = {}

# define a simple route
@app.route('/')
def home():
    return "AI server is Online!!"

# chat endpoint
@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')
    
    if not user_message:
        return jsonify({'error': 'No message provided.'}), 400
    
    if 'history' not in session:
        session['history'] = []

    try:
        # append user message to conversation history
        session['history'].append({"role": "user", "content": user_message})

        messages = [{"role": "user", "content": user_message}]

        print(f"--- 2. Sending to Ollama: {user_message} ---") # Checkpoint 2

        # send request to AI model
        response = ollama.chat(model=model_name, messages=session['history'])

        print("--- 3. Ollama Finished! ---") # Checkpoint 3

        # extract reply
        bot_reply = response['message']['content']

        # append bot reply to conversation history
        session['history'].append({"role": "bot", "content": bot_reply})

        session.modified = True  # mark session as modified to save changes
        
        return jsonify({'reply': bot_reply})
    
    except Exception as e:
        print(f'Error: {e}')
        return jsonify({'error': 'An error occurred while processing your request.'}), 500

# global chat endpoint
@socketio.on('connect')
def handle_connect():
    print('a user connected to global chat')

@socketio.on('disconnect')
def handle_disconnect():
    print('a user disconnected from global chat')

# listen to messages from clients/react
@socketio.on('send_message_to_server')
def handle_message(data):
    message = data['message']
    # get the username sent from client
    username = data.get('username', 'Anonymous')
    print(f'{username} says: {message}')

    # broadcast = true, means: send to all clients
    emit('receive_message_from_server', {'message': message, 'sender': username}, broadcast=True)

if __name__ == '__main__':
    load_dotenv()  # load environment variables from .env file
    socketio.run(app, debug=True, port=5000)