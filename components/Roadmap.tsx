import React from 'react';
import { RoadmapStep } from '../types';
import { TargetIcon, ProjectIcon, BrainIcon } from './Icons';

interface RoadmapStepProps {
  step: RoadmapStep;
  isLast: boolean;
}

const RoadmapItem: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; }> = ({ icon, title, children }) => (
  <div className="flex items-start space-x-3">
    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-blue-300">{icon}</div>
    <div>
      <h4 className="font-semibold text-gray-200">{title}</h4>
      <div className="text-gray-300">{children}</div>
    </div>
  </div>
);

const RoadmapStepComponent: React.FC<RoadmapStepProps> = ({ step, isLast }) => {
  return (
    <div className="relative pl-8">
      {/* Timeline styles */}
      <div className="absolute left-0 top-0 h-full w-px bg-gray-600">
        {/* The connecting line */}
        {!isLast && <div className="absolute top-0 left-0 w-px h-full bg-gray-500" />}
      </div>
      {/* The dot on the timeline */}
      <div className="absolute left-[-6px] top-1 h-3.5 w-3.5 rounded-full bg-blue-500 border-2 border-gray-800"></div>

      <div className="mb-8">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">{step.duration}</p>
          <h3 className="text-lg font-bold text-white">{step.title}</h3>
        </div>

        <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
          <RoadmapItem icon={<TargetIcon className="w-5 h-5" />} title="Key Goals">
            <ul className="list-disc list-inside space-y-1 mt-1">
              {step.goals.map((goal, i) => <li key={i}>{goal}</li>)}
            </ul>
          </RoadmapItem>

          <RoadmapItem icon={<ProjectIcon className="w-5 h-5" />} title="Mini Project">
            <p className="mt-1">{step.project}</p>
          </RoadmapItem>

          <RoadmapItem icon={<BrainIcon className="w-5 h-5" />} title="Skills to Practice">
            <ul className="list-disc list-inside space-y-1 mt-1">
                {step.skillsToPractice.map((skill, i) => <li key={i}>{skill}</li>)}
            </ul>
          </RoadmapItem>
        </div>
      </div>
    </div>
  );
};


export const Roadmap: React.FC<{ steps: RoadmapStep[] }> = ({ steps }) => {
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
       <h2 className="text-xl font-bold text-center mb-4">Your 12-Month Roadmap</h2>
      {steps.map((step, index) => (
        <RoadmapStepComponent 
          key={index} 
          step={step}
          isLast={index === steps.length - 1}
        />
      ))}
    </div>
  );
};
