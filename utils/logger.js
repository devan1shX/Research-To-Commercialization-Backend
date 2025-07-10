const fs = require('fs');
const path = require('path');
const { EOL } = require('os');

const logsDir = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const studyClickLogPath = path.join(logsDir, 'study_clicks.log');
const chatHistoryLogPath = path.join(logsDir, 'chat_history.log');

let isWritingStudyClicks = false;

const logStudyClick = (study) => {
  if (isWritingStudyClicks) {
    setTimeout(() => logStudyClick(study), 50);
    return;
  }

  isWritingStudyClicks = true;
  try {
    let lines = [];
    if (fs.existsSync(studyClickLogPath)) {
      const fileContent = fs.readFileSync(studyClickLogPath, 'utf-8');
      lines = fileContent.split(EOL).filter(line => line.trim() !== '');
    }

    const logIdentifier = `Study: ${study.title} (ID: ${study._id})`;
    let studyFound = false;
    
    const updatedLines = lines.map(line => {
      if (line.startsWith(logIdentifier)) {
        studyFound = true;
        const countMatch = line.match(/Clicks: (\d+)/);
        const currentCount = countMatch ? parseInt(countMatch[1]) : 0;
        return `${logIdentifier} - Clicks: ${currentCount + 1}`;
      }
      return line;
    });

    if (!studyFound) {
      updatedLines.push(`${logIdentifier} - Clicks: 1`);
    }

    fs.writeFileSync(studyClickLogPath, updatedLines.join(EOL) + EOL);

  } catch (error) {
    console.error('Failed to log study click:', error);
  } finally {
    isWritingStudyClicks = false;
  }
};

const logChatHistory = (user, studyId, chatHistory) => {
  if (!user || !user.email) return;

  try {
    const logHeader = `--- User: ${user.email} | Study ID: ${studyId} | Timestamp: ${new Date().toISOString()} ---`;
    const logBody = JSON.stringify(chatHistory, null, 2);
    const logEntry = `${logHeader}${EOL}${logBody}${EOL}${EOL}`;
    
    fs.appendFileSync(chatHistoryLogPath, logEntry);
  } catch (error) {
    console.error('Failed to log chat history:', error);
  }
};

module.exports = {
  logStudyClick,
  logChatHistory,
};
