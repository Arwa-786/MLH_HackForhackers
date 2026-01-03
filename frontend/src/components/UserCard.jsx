import React from 'react';

const UserCard = ({ user, matchScore, onSendRequest, isRequestSent, canSendRequest }) => {
  const getMatchScoreColor = (score) => {
    switch (score) {
      case 'strong':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'good':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'okay':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'bad':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getMatchScoreLabel = (score) => {
    return score.charAt(0).toUpperCase() + score.slice(1);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200 border border-gray-200">
      {/* Match Score Badge */}
      <div className="flex justify-between items-start mb-4">
        <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${getMatchScoreColor(matchScore)}`}>
          {getMatchScoreLabel(matchScore)} Match
        </div>
      </div>

      {/* User Name */}
      <h3 className="text-xl font-bold text-gray-800 mb-3">{user.name}</h3>

      {/* School and Location */}
      <div className="mb-3">
        <p className="text-sm text-gray-600 font-medium">School</p>
        <p className="text-gray-800">{user.school || 'Not specified'}</p>
        {user.location && (
          <>
            <p className="text-sm text-gray-600 font-medium mt-2">Location</p>
            <p className="text-gray-800">{user.location}</p>
          </>
        )}
      </div>

      {/* Skills */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 font-medium mb-2">Skills</p>
        <div className="flex flex-wrap gap-2">
          {user.skills && user.skills.length > 0 ? (
            user.skills.map((skill, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium"
              >
                {skill}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-sm">No skills listed</span>
          )}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 font-medium mb-2">Tech Stack</p>
        <div className="flex flex-wrap gap-2">
          {user.tech_stack && user.tech_stack.length > 0 ? (
            user.tech_stack.map((tech, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium"
          >
                {tech}
              </span>
            ))
        ) : (
            <span className="text-gray-400 text-sm">No tech stack listed</span>
        )}
        </div>
      </div>

      {/* Send Request Button */}
      <button
        onClick={() => onSendRequest(user._id)}
        disabled={isRequestSent || !canSendRequest}
        className={`w-full py-2 px-4 rounded-md font-semibold transition-colors duration-200 ${
          isRequestSent
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : !canSendRequest
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
        }`}
      >
        {isRequestSent ? 'Request Sent' : 'Send Request'}
      </button>
    </div>
  );
};

export default UserCard;

