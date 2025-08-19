import React from 'react';

interface BreadcrumbsProps {
  path: string;
  onSelectCategory: (path: string | null) => void;
  onGoHome: () => void;
}

const ChevronRightIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>);

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ path, onSelectCategory, onGoHome }) => {
  const parts = path.split('/').filter(p => p);

  return (
    <nav className="flex items-center space-x-2 text-lg text-gray-400 mb-4">
      <button onClick={onGoHome} className="hover:text-white transition-colors">
        Home
      </button>
      {parts.map((part, index) => {
        const currentPath = parts.slice(0, index + 1).join('/');
        const isLast = index === parts.length - 1;
        return (
          <React.Fragment key={currentPath}>
            <ChevronRightIcon className="w-5 h-5" />
            {isLast ? (
              <span className="font-bold text-white">{part}</span>
            ) : (
              <button onClick={() => onSelectCategory(currentPath)} className="hover:text-white transition-colors">
                {part}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
