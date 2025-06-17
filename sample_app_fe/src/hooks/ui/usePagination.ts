import React from "react";

const usePagination = <T>(
  items: T[] | undefined,
  itemsCountPerPage?: number,
) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = itemsCountPerPage ?? 10;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedItems = items?.slice(indexOfFirstItem, indexOfLastItem);

  const totalPages = React.useMemo(() => {
    return Math.max(Math.ceil((items?.length ?? [].length) / itemsPerPage), 1);
  }, [items, itemsPerPage]);

  const showPagination = (items?.length ?? [].length) > itemsPerPage;

  const setCurrentPageHandler = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // strict equality check to ensure that the current page is not greater than the total pages
  React.useEffect(() => {
    // ensuring that the current page is not greater than the total pages
    if (currentPage > totalPages) {
      setCurrentPageHandler(totalPages);
    }
  }, [currentPage, totalPages]);

  return {
    setCurrentPage: setCurrentPageHandler,
    paginatedItems,
    currentPage,
    totalPages,
    showPagination,
  };
};

export default usePagination;
