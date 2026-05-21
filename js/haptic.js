/**
 * Haptic feedback module.
 */
export const Haptic = {
  trigger(type = 'light') {
    if (!navigator.vibrate) return;
    
    if (type === 'light') navigator.vibrate(5);
    if (type === 'medium') navigator.vibrate(15);
    if (type === 'heavy') navigator.vibrate([20, 30, 20]);
  }
};
