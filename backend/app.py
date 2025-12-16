# import necessary modules
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_session import Session
from dotenv import load_dotenv
import google.generativeai as genai
import os

# Switching from local AI to Google's cloud AI
# 1. load the secret key from .env file
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# 2. configure AI
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash') # A fast, efficient model

# Implementing memory for context retention
chat_session = model.start_chat(history=[])

# create Flask app
app = Flask(__name__)

# configure security key
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
    user_id = data.get('user_id')

    if user_id not in user_sessions:
        # create if not
        user_sessions[user_id] = model.start_chat(history=[])
    
    # get user's chat sessions
    current_session = user_sessions[user_id]

    # ask gemini a question
    response = current_session.send_message(user_message)

    bot_reply = response.text
    
    return jsonify({'reply': bot_reply})

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