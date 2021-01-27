function endsWith(subject, search) {
  var length = subject.length;
  return subject.substring(length - search.length, length) === search;
}