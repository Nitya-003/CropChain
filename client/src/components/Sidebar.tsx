import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const sidebarVariants = {
  open: {
    x: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  closed: {
    x: "-100%",
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
};

const backdropVariants = {
  open: { opacity: 1 },
  closed: { opacity: 0 },
};

const Sidebar = ({ isOpen, setIsOpen, navItems }) => {
  const location = useLocation();
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    // cleanup when component unmounts
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial='closed'
            animate='open'
            exit='closed'
            variants={backdropVariants}
            onClick={() => setIsOpen(false)}
            className='fixed inset-0 bg-black/50 z-40 backdrop-blur-sm'
          />

          <motion.div
            initial='closed'
            animate='open'
            exit='closed'
            variants={sidebarVariants}
            className='fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col'
          >
            <div className='p-4 flex justify-end'>
              <button
                onClick={() => setIsOpen(false)}
                className='p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
              >
                <X className='h-6 w-6 text-gray-500' />
              </button>
            </div>

            <nav className='flex-1 px-4 space-y-2'>
              {navItems.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setIsOpen(false)}
                  className='flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-green-100 dark:hover:bg-gray-800 transition-colors'
                >
                  <Icon className='h-5 w-5' />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
