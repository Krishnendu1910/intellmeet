require('dotenv').config();
const Meeting = require('../models/meeting'); 

exports.generateSummary = async (req, res) => {
    try {
        const { transcript, roomId } = req.body;
        if (!transcript || transcript.trim().length < 10) {
            return res.status(400).json({ message: "Transcript is too short. Please speak a little more." });
        }

        const apiKey = process.env.GROQ_API_KEY;
        const prompt = `You are an AI Assistant. Summarize this meeting transcript briefly:\n\n${transcript}`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.7 })
        });

        const data = await response.json();
        const summary = data.choices[0].message.content;
        
        if (roomId) await Meeting.findOneAndUpdate({ roomId }, { summary });
        res.status(200).json({ summary });
    } catch (error) {
        res.status(500).json({ message: "Failed to generate AI summary." });
    }
};

exports.endMeetingAndSummarize = async (req, res) => {
    try {
        const { transcript, roomId, chatMessages, sharedNotes, manualTasks } = req.body;
        const apiKey = process.env.GROQ_API_KEY;

        let finalSummary = "Meeting was concluded successfully. No significant data was captured.";
        let extractedTasks = [];

        let chatString = "";
        if (chatMessages && chatMessages.length > 0) {
            chatString = chatMessages.map(m => `${m.sender}: ${m.text}`).join('\n');
        }

        if ((transcript || chatString || sharedNotes) && apiKey) {
            
            const prompt = `You are a professional Executive Assistant. Analyze all provided meeting data and provide:
            1. **Final Meeting Summary** (Combine insights from audio, chat, and shared notes)
            2. **Action Items** (List each specific task strictly as a bullet point starting with '-' or '*')

            --- DATA ---
            TRANSCRIPT: ${transcript || "None"}
            CHAT: ${chatString || "None"}
            NOTES: ${sharedNotes || "None"}
            ------------`;

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.7 })
            });

            const data = await response.json();
            if (response.ok) {
                finalSummary = data.choices[0].message.content;
         
                const lines = finalSummary.split('\n');
                let captureTasks = false;
                
                lines.forEach(line => {
                    const lowerLine = line.toLowerCase();
                    if (lowerLine.includes('action items') || lowerLine.includes('next steps')) {
                        captureTasks = true;
                        return; 
                    }
                    
                    if (captureTasks) {
                        if (line.startsWith('#') || (line.startsWith('**') && !line.trim().startsWith('-') && !line.trim().startsWith('*'))) {
                            captureTasks = false;
                            return;
                        }

                        if (line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim())) {
                            let cleanText = line.replace(/^[-*\d.]\s*/, '').replace(/\*\*/g, '').trim();
                            if(cleanText.length > 3) {
                                extractedTasks.push({
                                    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                    text: cleanText,
                                    status: 'todo',
                                    creator: 'AI Assistant'
                                });
                            }
                        }
                    }
                });
            }
        }

        // FIX: Manual tasks ka status forcefully change nahi hoga
        const finalTasksList = [...extractedTasks, ...(manualTasks || []).map(t => ({...t, status: t.status || 'todo'}))];

        if (roomId) {
            await Meeting.findOneAndUpdate(
                { roomId: roomId },
                { 
                    summary: finalSummary, 
                    sharedNotes: sharedNotes || "",
                    status: 'Completed', 
                    tasks: finalTasksList 
                },
                { new: true }
            );
        }

        res.status(200).json({ message: "Meeting ended", summary: finalSummary });

    } catch (error) {
        console.error("End Meeting Error:", error);
        res.status(500).json({ message: "Failed to end meeting." });
    }
};