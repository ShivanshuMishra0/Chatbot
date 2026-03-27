import os
import certifi
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Missing imports handle karne ke liye try-except
try:
    import google.generativeai as genai
except ImportError:
    print("❌ Error: 'google-generativeai' not found. Run: pip install google-generativeai")

# --- 0. INITIALIZATION ---
load_dotenv(override=True)  # .env file se variables load karein

# Debugging: Terminal mein check karne ke liye key load hui ya nahi
print(f"DEBUG: API Key load hui? -> {'Yes' if os.getenv('GEMINI_API_KEY') else 'No'}")

app = Flask(__name__)
CORS(app)

# Environment Variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")

# --- 1. GEMINI AI SETUP (Smart Fix) ---
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    try:
        # Step A: Available models ki list check karte hain
        available_models = [m.name for m in genai.list_models() 
                            if 'generateContent' in m.supported_generation_methods]
        
        print(f"DEBUG: Available Models -> {available_models}")

        # Step B: Sabse best model select karte hain (Priority: 1.5-flash > 1.5-pro > any)
        if any("models/gemini-1.5-flash" in m for m in available_models):
            selected_model = "models/gemini-1.5-flash"
        elif any("models/gemini-1.5-pro" in m for m in available_models):
            selected_model = "models/gemini-1.5-pro"
        elif available_models:
            selected_model = available_models[0]
        else:
            selected_model = None

        if selected_model:
            model = genai.GenerativeModel(selected_model)
            print(f"🚀 Selected Model: {selected_model}")
            print("✅ MyAI Engine is ready, Sir.")
        else:
            print("❌ No compatible models found.")
            model = None

    except Exception as e:
        print(f"❌ Gemini Setup Error: {e}")
        model = None
else:
    print("❌ GEMINI_API_KEY missing in .env file!")
    model = None

# --- 2. MONGODB SETUP ---
try:
    ca = certifi.where()
    client = MongoClient(MONGO_URI, tls=True, tlsCAFile=ca)
    db_mongo = client['MyAIDatabase']
    users_collection = db_mongo['users']
    chats_collection = db_mongo['chats']
    client.admin.command('ping')
    print("✅ Connected to MongoDB Atlas successfully!")
except Exception as e:
    print(f"❌ MongoDB Connection Error: {e}")

# --- ROUTES ---

# 1. SIGNUP ROUTE
@app.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        fullname = data.get('fullname')
        email_raw = data.get('email')
        
        if not email_raw or not data.get('password'):
            return jsonify({"success": False, "message": "Email and password are required"}), 400
            
        email = email_raw.lower()
        password = data.get('password')

        if users_collection.find_one({"email": email}):
            return jsonify({"success": False, "message": "Email already registered"}), 400
        
        hashed_password = generate_password_hash(password)
        users_collection.insert_one({
            "fullname": fullname,
            "email": email,
            "password": hashed_password
        })
        return jsonify({"success": True, "message": "User registered successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# 2. LOGIN ROUTE
@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        email_raw = data.get('email')
        if not email_raw:
            return jsonify({"success": False, "message": "Email required"}), 400
            
        email = email_raw.lower()
        password = data.get('password')

        user = users_collection.find_one({"email": email})
        if user and check_password_hash(user['password'], password):
            return jsonify({
                "success": True, 
                "fullname": user['fullname'],
                "message": "Access Granted, Sir!"
            })
        return jsonify({"success": False, "message": "Invalid email or password"}), 401
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# 3. CHAT ROUTE (With Robust Error Handling)
@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        if not data:
            return jsonify({"success": False, "message": "No data received"}), 400

        # SAFE EMAIL GETTING: NoneType error se bachne ke liye
        email_input = data.get('email')
        email = email_input.lower() if email_input else "guest@test.com"
        
        user_msg = data.get('message', '')

        if not model:
            print("❌ ERROR: Gemini Model not initialized.")
            return jsonify({"success": False, "message": "AI Engine is offline, Sir."}), 500

        # System Instruction: Jarvis Persona
        prompt = f"Act as Jarvis from Iron Man. Be witty, professional, and call the user Sir. User: {user_msg}"
        
        # Generate Content with AI Error Handling
        try:
            response = model.generate_content(prompt)
            if response and hasattr(response, 'text') and response.text:
                bot_res = response.text
            else:
                print("⚠️ Warning: Gemini response blocked or empty.")
                bot_res = "Sir, my safety protocols are preventing a response. Please try rephrasing."
        except Exception as ai_err:
            print(f"❌ Gemini API Error: {ai_err}")
            return jsonify({"success": False, "message": "Neural link timeout. Try again."}), 500

        # Save to MongoDB
        try:
            chats_collection.insert_one({
                "email": email,
                "user_msg": user_msg,
                "bot_res": bot_res,
                "timestamp": datetime.utcnow()
            })
        except Exception as db_err:
            print(f"⚠️ MongoDB Save Error: {db_err}")

        return jsonify({"success": True, "response": bot_res})

    except Exception as e:
        print(f"❌ CRITICAL SYSTEM ERROR: {str(e)}")
        return jsonify({"success": False, "message": "Internal system failure, Sir."}), 500

# 4. GET CHAT HISTORY
@app.route('/get-chats', methods=['GET'])
def get_chats():
    try:
        email_raw = request.args.get('email')
        if not email_raw:
            return jsonify({"success": False, "message": "Email required"}), 400
        
        email = email_raw.lower()
        chats = list(chats_collection.find({"email": email}).sort("_id", -1).limit(20))
        for chat in chats:
            chat['_id'] = str(chat['_id'])
            
        return jsonify({"success": True, "chats": chats})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# 5. CLEAR CHAT HISTORY
@app.route('/clear-history', methods=['POST'])
def clear_history():
    try:
        data = request.json
        email_raw = data.get('email')
        if not email_raw:
            return jsonify({"success": False, "message": "Email required"}), 400
            
        email = email_raw.lower()
        result = chats_collection.delete_many({"email": email})
        return jsonify({"success": True, "message": f"Sir, I have purged {result.deleted_count} logs."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# 6. ANALYTICS ROUTE
@app.route('/get-analytics', methods=['GET'])
def get_analytics():
    try:
        email_raw = request.args.get('email')
        if not email_raw:
            return jsonify({"success": False, "message": "Email required"}), 400
            
        email = email_raw.lower()
        total_messages = chats_collection.count_documents({"email": email})
        last_chat = chats_collection.find_one({"email": email}, sort=[("timestamp", -1)])
        
        return jsonify({
            "success": True,
            "total_messages": total_messages,
            "last_interaction": last_chat['timestamp'] if last_chat else "N/A"
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    # Debug=True helps in development to see errors instantly
    app.run(debug=True, port=5000)