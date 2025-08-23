import { Table, List, Card, Typography } from 'antd';
import { useIsMobile } from '@/hooks/use-mobile';

const { Text } = Typography;

interface ResponsiveTableProps {
  columns: any[];
  dataSource: any[];
  loading?: boolean;
  rowKey: string;
  pagination?: any;
  locale?: any;
  className?: string;
  cardTitle?: (record: any) => React.ReactNode;
  cardExtra?: (record: any) => React.ReactNode;
}

const ResponsiveTable = ({
  columns,
  dataSource,
  loading,
  rowKey,
  pagination,
  locale,
  className,
  cardTitle,
  cardExtra
}: ResponsiveTableProps) => {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        rowKey={rowKey}
        pagination={pagination}
        locale={locale}
        className={className}
        scroll={{ x: 800 }}
      />
    );
  }

  // Mobile card view
  return (
    <List
      loading={loading}
      dataSource={dataSource}
      pagination={pagination}
      locale={locale}
      className={className}
      renderItem={(record) => (
        <List.Item key={record[rowKey]} style={{ padding: 0, marginBottom: 12 }}>
          <Card
            size="small"
            title={cardTitle ? cardTitle(record) : record[columns[0]?.dataIndex]}
            extra={cardExtra ? cardExtra(record) : null}
            style={{ width: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {columns.slice(1).map((column) => {
                if (column.key === 'actions') return null;
                
                const value = column.dataIndex 
                  ? Array.isArray(column.dataIndex)
                    ? column.dataIndex.reduce((obj, key) => obj?.[key], record)
                    : record[column.dataIndex]
                  : record;

                return (
                  <div key={column.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '12px', minWidth: 80 }}>
                      {column.title}:
                    </Text>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      {column.render ? column.render(value, record) : value}
                    </div>
                  </div>
                );
              })}
              
              {/* Actions row */}
              {columns.find(col => col.key === 'actions') && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                  {columns.find(col => col.key === 'actions').render(null, record)}
                </div>
              )}
            </div>
          </Card>
        </List.Item>
      )}
    />
  );
};

export default ResponsiveTable;